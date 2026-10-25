import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../common/auth-user';
import { RealtimeEventName, userRoom } from './realtime.events';

/**
 * Push-only socket.io gateway. Connect with the same JWT as the REST API:
 * `io(url, { auth: { token } })`. Each socket joins its user's room, so every
 * open tab or device of that user receives the events.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(tokenOf(client));
      await client.join(userRoom(payload.sub));
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  emitToUser(userId: bigint, event: RealtimeEventName, payload: unknown) {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  emitToUsers(userIds: bigint[], event: RealtimeEventName, payload: unknown) {
    this.server?.to(userIds.map((id) => userRoom(id))).emit(event, payload);
  }
}

/** Token from `auth: { token }`, or an `Authorization: Bearer …` header. */
function tokenOf(client: Socket): string {
  const auth = client.handshake.auth as { token?: unknown };
  if (typeof auth.token === 'string') return auth.token;
  const [scheme, token] =
    client.handshake.headers.authorization?.split(' ') ?? [];
  if (scheme === 'Bearer' && token) return token;
  throw new Error('Missing token');
}
