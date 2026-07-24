// langage de requete maison pour les collections MongoDB
// lexer + parser ecrits a la main (equivalent lex/yacc cote Node)
//
// grammaire :
//   QUERY := FIND IDENT (WHERE CONDITIONS)? (LIMIT NUMBER)?
//   CONDITIONS := CONDITION ((AND | OR) CONDITION)*
//   CONDITION := IDENT OP VALUE
//   OP := = | != | > | < | >= | <= | CONTAINS
//   VALUE := STRING | NUMBER | true | false
//
// exemple : FIND events WHERE tags CONTAINS "musique" AND title = "Concert" LIMIT 5

export interface RequeteAnalysee {
    collection: string
    filtreMongo: Record<string, any>
    limite: number | null
}

// un jeton = un morceau de la requete avec sa categorie
// MOT_CLE = mot du langage (FIND, WHERE...), IDENTIFIANT = nom ecrit par
// l'utilisateur (collection, champ), CHAINE / NOMBRE = valeurs, OPERATEUR = comparaison
type Jeton = {
    categorie: "MOT_CLE" | "IDENTIFIANT" | "CHAINE" | "NOMBRE" | "OPERATEUR"
    valeur: string
}

const MOTS_CLES = new Set(["FIND", "WHERE", "LIMIT", "AND", "OR", "CONTAINS"])

// --- lexer : decoupe le texte en jetons ---
function decouperEnJetons(texteRequete: string): Jeton[] {
    const jetons: Jeton[] = []
    let position = 0
    while (position < texteRequete.length) {
        const caractere = texteRequete[position]!
        if (/\s/.test(caractere)) { position++; continue }

        // chaine entre guillemets simples ou doubles
        if (caractere === '"' || caractere === "'") {
            const guillemet = caractere; position++
            let contenuChaine = ""
            while (position < texteRequete.length && texteRequete[position] !== guillemet) {
                contenuChaine += texteRequete[position]!; position++
            }
            if (position >= texteRequete.length) throw new Error("Chaîne non terminée")
            position++ // guillemet fermant
            jetons.push({ categorie: "CHAINE", valeur: contenuChaine })
            continue
        }

        // nombre (entier/decimal, negatif possible)
        if (/[0-9]/.test(caractere) || (caractere === "-" && /[0-9]/.test(texteRequete[position + 1] ?? ""))) {
            let nombreLu = caractere; position++
            while (position < texteRequete.length && /[0-9.]/.test(texteRequete[position]!)) {
                nombreLu += texteRequete[position]!; position++
            }
            jetons.push({ categorie: "NOMBRE", valeur: nombreLu })
            continue
        }

        // operateur de comparaison
        if (/[<>=!]/.test(caractere)) {
            let operateur = caractere; position++
            if (texteRequete[position] === "=") { operateur += "="; position++ }
            jetons.push({ categorie: "OPERATEUR", valeur: operateur })
            continue
        }

        // identifiant ou mot-cle
        if (/[A-Za-z_]/.test(caractere)) {
            let mot = caractere; position++
            while (position < texteRequete.length && /[A-Za-z0-9_.]/.test(texteRequete[position]!)) {
                mot += texteRequete[position]!; position++
            }
            const motEnMajuscules = mot.toUpperCase()
            if (MOTS_CLES.has(motEnMajuscules)) jetons.push({ categorie: "MOT_CLE", valeur: motEnMajuscules })
            else jetons.push({ categorie: "IDENTIFIANT", valeur: mot })
            continue
        }

        throw new Error(`Caractère inattendu: '${caractere}'`)
    }
    return jetons
}

// --- helpers ---
// donne son vrai type a la valeur : "5" devient 5, "true" devient true...
function convertirValeur(jeton: Jeton): any {
    if (jeton.categorie === "NOMBRE") return Number(jeton.valeur)
    if (jeton.categorie === "CHAINE") return jeton.valeur
    if (jeton.categorie === "IDENTIFIANT") {
        if (jeton.valeur === "true") return true
        if (jeton.valeur === "false") return false
        return jeton.valeur
    }
    return jeton.valeur
}

// echappe les metacaracteres regex : CONTAINS "a.b" doit chercher la sous-chaine
// "a.b" telle quelle, pas une regex. ca protege aussi du ReDoS (regex piegee
// injectee dans la valeur cherchee)
function echapperRegex(texte: string): string {
    return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// traduit un operateur du langage vers son equivalent MongoDB
function operateurVersMongo(operateur: string, valeur: any): any {
    switch (operateur) {
        case "=":  return valeur
        case "!=": return { $ne: valeur }
        case ">":  return { $gt: valeur }
        case "<":  return { $lt: valeur }
        case ">=": return { $gte: valeur }
        case "<=": return { $lte: valeur }
        case "CONTAINS": return { $regex: echapperRegex(String(valeur)), $options: "i" }
        default: throw new Error(`Opérateur inconnu: ${operateur}`)
    }
}

// --- parser (descente recursive) : consomme les jetons dans l'ordre de la
// grammaire et construit directement le filtre MongoDB ---
export function analyserRequete(texteRequete: string): RequeteAnalysee {
    const jetons = decouperEnJetons(texteRequete)
    let position = 0
    const regarder = () => jetons[position]                 // lit sans consommer
    const consommer = () => jetons[position++]              // lit et avance
    const attendre = (categorie: Jeton["categorie"], valeur?: string): Jeton => {
        const jeton = consommer()
        if (!jeton || jeton.categorie !== categorie || (valeur !== undefined && jeton.valeur !== valeur)) {
            throw new Error(`Syntaxe invalide : attendu '${valeur ?? categorie}'`)
        }
        return jeton
    }

    const lireCondition = (): Record<string, any> => {
        const champ = attendre("IDENTIFIANT").valeur
        const jeton = consommer()
        if (!jeton) throw new Error("Opérateur attendu")
        let operateur: string
        if (jeton.categorie === "OPERATEUR") operateur = jeton.valeur
        else if (jeton.categorie === "MOT_CLE" && jeton.valeur === "CONTAINS") operateur = "CONTAINS"
        else throw new Error("Opérateur attendu")
        const jetonValeur = consommer()
        if (!jetonValeur) throw new Error("Valeur attendue")
        return { [champ]: operateurVersMongo(operateur, convertirValeur(jetonValeur)) }
    }

    const lireConditions = (): Record<string, any> => {
        let filtreGauche = lireCondition()
        while (regarder()?.categorie === "MOT_CLE" && (regarder()?.valeur === "AND" || regarder()?.valeur === "OR")) {
            const liaison = consommer()!.valeur
            const filtreDroit = lireCondition()
            filtreGauche = liaison === "AND" ? { $and: [filtreGauche, filtreDroit] } : { $or: [filtreGauche, filtreDroit] }
        }
        return filtreGauche
    }

    attendre("MOT_CLE", "FIND")
    const collection = attendre("IDENTIFIANT").valeur

    let filtreMongo: Record<string, any> = {}
    if (regarder()?.categorie === "MOT_CLE" && regarder()?.valeur === "WHERE") {
        consommer()
        filtreMongo = lireConditions()
    }

    let limite: number | null = null
    if (regarder()?.categorie === "MOT_CLE" && regarder()?.valeur === "LIMIT") {
        consommer()
        limite = Number(attendre("NOMBRE").valeur)
    }

    if (position < jetons.length) throw new Error("Tokens en trop après la requête")
    return { collection, filtreMongo, limite }
}
