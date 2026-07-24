import { mock } from "node:test"

/**
 * Fabrique un faux Repository TypeORM (objet avec des `mock.fn`).
 * On caste en `any` lorsqu'on le passe à un Usecase, car on ne fournit
 * que les méthodes réellement utilisées par le code testé.
 *
 * `overrides` permet de remplacer le comportement par défaut d'une méthode
 * pour un test précis (ex. faire renvoyer un objet à `findOneBy`).
 */
export function createMockRepository(overrides: Record<string, unknown> = {}) {
    const repo: Record<string, unknown> = {
        create: mock.fn((x: unknown) => x),
        save: mock.fn(async (x: unknown) => x),
        findOne: mock.fn(async () => null),
        findOneBy: mock.fn(async () => null),
        find: mock.fn(async () => []),
        softDelete: mock.fn(async () => ({ affected: 1 })),
        delete: mock.fn(async () => ({ affected: 1 })),
        update: mock.fn(async () => ({ affected: 1 })),
        createQueryBuilder: mock.fn(() => {
            const qb: Record<string, unknown> = {
                where: mock.fn(() => qb),
                andWhere: mock.fn(() => qb),
                leftJoinAndSelect: mock.fn(() => qb),
                getMany: mock.fn(async () => [])
            }
            return qb
        })
    }
    return Object.assign(repo, overrides)
}
