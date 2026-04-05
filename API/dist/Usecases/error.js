export class ResourceConflictError extends Error {
    message;
    constructor(message) {
        super(message);
        this.message = message;
    }
}
