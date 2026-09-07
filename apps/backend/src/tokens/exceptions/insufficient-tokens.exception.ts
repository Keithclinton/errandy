import { ConflictException } from "@nestjs/common";

export class InsufficientTokensException extends ConflictException {}
