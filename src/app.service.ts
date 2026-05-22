import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      name: 'hanoigo-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
