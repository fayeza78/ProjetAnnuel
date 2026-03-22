export class ResourceConflictError extends Error {
    constructor(public message: string) {
        super(message)
    }
}