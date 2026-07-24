import { compare, hash } from "bcrypt";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { Repository } from "typeorm";
import {
  Token,
  TokenType,
} from "../Database/Entites_PostGreSQL/token_POSTGRE.js";
import { User } from "../Database/Entites_PostGreSQL/user_POSTGRE.js";
import { getJwtSecret } from "../Middleware/jwt.js";
import {
  chiffrerSecret,
  dechiffrerSecret,
} from "../Middleware/secret-crypto.js";

// le sujet demande la MFA sur les actions sensibles : par defaut on refuse les
// comptes qui ne l'ont pas activee. MFA_ENFORCE=false coupe cette obligation
// (pratique en demo), mais un compte qui a la MFA doit quand meme donner son code
const mfaObligatoire = () => process.env.MFA_ENFORCE !== "false";

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id_user: number;
    email: string;
    role: string;
  };
}

// resultat d'une action sensible (changement mdp / email / telephone)
// type comme ca pour que le handler traduise chaque cas en bon code HTTP
export type SensitiveChangeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_found"
        | "wrong_password"
        | "mfa_required"
        | "mfa_invalid"
        | "mfa_setup_required"
        | "email_taken";
    };

export class AuthUsecase {
  constructor(
    private userRepository: Repository<User>,
    private tokenRepository: Repository<Token>,
  ) {}

  private generateAccessToken(user: User): string {
    return jwt.sign(
      { userId: user.id_user, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: "1h" },
    );
  }

  private async createRefreshToken(user: User): Promise<Token> {
    const refreshToken = randomUUID();
    const expireA = new Date();
    expireA.setDate(expireA.getDate() + 30);

    const token = this.tokenRepository.create({
      token: refreshToken,
      type: TokenType.REFRESH,
      user,
      expireA,
    });

    return await this.tokenRepository.save(token);
  }

  async login({
    email,
    password,
    code,
  }: {
    email: string;
    password: string;
    code?: string;
  }): Promise<AuthResponse | { mfa_required: true } | null> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) return null;

    const isValid = await compare(password, user.password);
    if (!isValid) return null;

    // si la MFA est activee, il faut un code TOTP valide
    if (user.mfa_enabled) {
      if (!code) return { mfa_required: true };
      if (!authenticator.check(code, dechiffrerSecret(user.mfa_secret)))
        return null;
    }

    const access_token = this.generateAccessToken(user);
    const refreshTokenRecord = await this.createRefreshToken(user);

    return {
      access_token,
      refresh_token: refreshTokenRecord.token,
      token_type: "Bearer",
      expires_in: 3600,
      user: {
        id_user: user.id_user,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ access_token: string; expires_in: number } | null> {
    const tokenRecord = await this.tokenRepository.findOne({
      where: { token: refreshToken, type: TokenType.REFRESH },
      relations: ["user"],
    });

    if (!tokenRecord) return null;

    if (tokenRecord.expireA && tokenRecord.expireA < new Date()) {
      await this.tokenRepository.softDelete(tokenRecord.id_token);
      return null;
    }

    const access_token = this.generateAccessToken(tokenRecord.user);
    return { access_token, expires_in: 3600 };
  }

  async logout(refreshToken: string): Promise<boolean> {
    const tokenRecord = await this.tokenRepository.findOneBy({
      token: refreshToken,
    });
    if (!tokenRecord) return false;

    await this.tokenRepository.softDelete(tokenRecord.id_token);
    return true;
  }

  async getMe(userId: number): Promise<User | null> {
    // relation quartier chargee pour que /auth/me (profil, header) l'affiche
    return await this.userRepository.findOne({
      where: { id_user: userId },
      relations: ["quartier"],
    });
  }

  // genere un secret TOTP et le rattache au compte (pas encore actif)
  // le secret est chiffre avant d'etre stocke, le clair n'est renvoye qu'une
  // seule fois pour afficher le QR code
  async setupMfa(
    userId: number,
  ): Promise<{ secret: string; otpauthUrl: string } | null> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user) return null;

    const secret = authenticator.generateSecret();
    user.mfa_secret = chiffrerSecret(secret);
    await this.userRepository.save(user);

    const otpauthUrl = authenticator.keyuri(
      user.email,
      "Connected Neighbours",
      secret,
    );
    return { secret, otpauthUrl };
  }

  // desactive la MFA et oublie le secret
  async disableMfa(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user) return false;

    user.mfa_enabled = false;
    user.mfa_secret = null as any;
    await this.userRepository.save(user);
    return true;
  }

  // verifie un premier code TOTP et active la MFA
  async verifyMfa(userId: number, code: string): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user || !user.mfa_secret) return false;

    if (!authenticator.check(code, dechiffrerSecret(user.mfa_secret)))
      return false;

    user.mfa_enabled = true;
    await this.userRepository.save(user);
    return true;
  }

  // --- actions sensibles : on reverifie l'identite (mot de passe + MFA) ---
  // verifie le mot de passe actuel et, si la MFA est activee, un code TOTP valide
  // utilise avant tout changement de mot de passe / email / telephone
  private async verifierIdentite(
    user: User,
    password: string,
    code?: string,
  ): Promise<
    | "ok"
    | "wrong_password"
    | "mfa_required"
    | "mfa_invalid"
    | "mfa_setup_required"
  > {
    const motDePasseOk = await compare(password, user.password);
    if (!motDePasseOk) return "wrong_password";

    // un compte sans MFA doit d'abord l'activer (setup + verify),
    // sauf si MFA_ENFORCE est desactive
    if (!user.mfa_enabled) {
      return mfaObligatoire() ? "mfa_setup_required" : "ok";
    }

    if (!code) return "mfa_required";
    if (!authenticator.check(code, dechiffrerSecret(user.mfa_secret)))
      return "mfa_invalid";
    return "ok";
  }

  // changement de mot de passe : mot de passe actuel + MFA
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    code?: string,
  ): Promise<SensitiveChangeResult> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user) return { ok: false, reason: "not_found" };

    const verif = await this.verifierIdentite(user, currentPassword, code);
    if (verif !== "ok") return { ok: false, reason: verif };

    user.password = await hash(newPassword, 10);
    await this.userRepository.save(user);

    // par securite on revoque les sessions existantes (refresh tokens) du compte
    await this.tokenRepository
      .createQueryBuilder()
      .softDelete()
      .where("id_user = :id", { id: userId })
      .execute();

    return { ok: true };
  }

  // changement d'email : mot de passe + MFA + email pas deja pris
  async changeEmail(
    userId: number,
    password: string,
    newEmail: string,
    code?: string,
  ): Promise<SensitiveChangeResult> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user) return { ok: false, reason: "not_found" };

    const verif = await this.verifierIdentite(user, password, code);
    if (verif !== "ok") return { ok: false, reason: verif };

    // l'email ne doit pas deja appartenir a un autre compte
    const existant = await this.userRepository.findOneBy({ email: newEmail });
    if (existant && existant.id_user !== userId)
      return { ok: false, reason: "email_taken" };

    user.email = newEmail;
    await this.userRepository.save(user);
    return { ok: true };
  }

  // changement de telephone : mot de passe + MFA
  async changePhone(
    userId: number,
    password: string,
    telephone: string,
    code?: string,
  ): Promise<SensitiveChangeResult> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user) return { ok: false, reason: "not_found" };

    const verif = await this.verifierIdentite(user, password, code);
    if (verif !== "ok") return { ok: false, reason: verif };

    user.telephone = telephone;
    await this.userRepository.save(user);
    return { ok: true };
  }

  // --- SSO entre le site web et le client Java ---
  // le user deja connecte au site demande un ticket a usage unique (2 min)
  // le client Java echange ensuite ce ticket contre des tokens sans redemander
  // le mot de passe, c'est le principe du SSO
  async createSsoTicket(userId: number): Promise<string | null> {
    const user = await this.userRepository.findOneBy({ id_user: userId });
    if (!user) return null;

    const code = randomUUID();
    const expireA = new Date();
    expireA.setMinutes(expireA.getMinutes() + 2); // ticket volontairement court

    await this.tokenRepository.save(
      this.tokenRepository.create({
        token: code,
        type: TokenType.SSO,
        user,
        expireA,
      }),
    );
    return code;
  }

  // echange un ticket SSO valide contre des tokens (comme un login), usage unique
  async exchangeSsoTicket(code: string): Promise<AuthResponse | null> {
    const ticket = await this.tokenRepository.findOne({
      where: { token: code, type: TokenType.SSO },
      relations: ["user"],
    });
    if (!ticket) return null;

    // expire ? on le supprime et on refuse
    if (ticket.expireA && ticket.expireA < new Date()) {
      await this.tokenRepository.softDelete(ticket.id_token);
      return null;
    }

    // usage unique : on consomme le ticket tout de suite
    await this.tokenRepository.softDelete(ticket.id_token);

    const access_token = this.generateAccessToken(ticket.user);
    const refreshTokenRecord = await this.createRefreshToken(ticket.user);
    return {
      access_token,
      refresh_token: refreshTokenRecord.token,
      token_type: "Bearer",
      expires_in: 3600,
      user: {
        id_user: ticket.user.id_user,
        email: ticket.user.email,
        role: ticket.user.role,
      },
    };
  }

  // --- mot de passe oublie ---
  // genere un ticket de reinitialisation a usage unique, valable 15 min
  // (c'est le TokenType.RESET_PASSWORD du modele)
  // renvoie null si l'email est inconnu mais le handler repond pareil dans les
  // deux cas, pour ne pas reveler quels emails existent
  async forgotPassword(email: string): Promise<string | null> {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) return null;

    const token = randomUUID();
    const expireA = new Date();
    expireA.setMinutes(expireA.getMinutes() + 15);

    await this.tokenRepository.save(
      this.tokenRepository.create({
        token,
        type: TokenType.RESET_PASSWORD,
        user,
        expireA,
      }),
    );
    return token;
  }

  // consomme le ticket (usage unique), remplace le mot de passe (bcrypt) et
  // revoque toutes les sessions du compte
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const ticket = await this.tokenRepository.findOne({
      where: { token, type: TokenType.RESET_PASSWORD },
      relations: ["user"],
    });
    if (!ticket || !ticket.user) return false;

    if (ticket.expireA && ticket.expireA < new Date()) {
      await this.tokenRepository.softDelete(ticket.id_token);
      return false;
    }

    // usage unique : consomme direct
    await this.tokenRepository.softDelete(ticket.id_token);

    ticket.user.password = await hash(newPassword, 10);
    await this.userRepository.save(ticket.user);

    // toutes les sessions ouvertes deviennent invalides (refresh tokens revoques)
    await this.tokenRepository
      .createQueryBuilder()
      .softDelete()
      .where("id_user = :id", { id: ticket.user.id_user })
      .execute();

    return true;
  }
}
