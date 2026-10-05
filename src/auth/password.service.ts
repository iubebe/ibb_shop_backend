import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password).catch(() => false);
  }

  /** Burns the same time as a real check, so unknown emails aren't detectable. */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('dummy-password');
    await this.verify(await this.dummyHash, password);
  }
}
