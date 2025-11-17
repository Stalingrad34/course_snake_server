import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

class Vector2 {
    x: number;
    z: number;
}

const SPAWN_POINTS: Vector2[] = [{x:10, z:10}, {x:-10, z:10}, {x:10, z:-10}, {x:-10, z:-10}]

export class Player extends Schema {
    @type("number") speed = 0;
    @type("uint16") p = 0;
    @type("uint16") c = 0;
    @type("number") pX = 0;
    @type("number") pZ = 0;
}

export class State extends Schema {
    @type({ map: Player })
    players = new MapSchema<Player>();
    colorsLength: number;
    spawnPointsLength: number;
    colors: number[] = [];

    createPlayer(sessionId: string, data: any) {
        const colorIdx = this.getPlayerColor();
        this.colors.push(colorIdx);

        const player = new Player();
        player.speed = data.speed;
        player.p = data.parts;
        player.c = colorIdx;

        const spawnPosition = SPAWN_POINTS[this.players.size]
        player.pX = spawnPosition.x;
        player.pZ = spawnPosition.z;

        this.players.set(sessionId, player);
    }

    removePlayer(sessionId: string) {
        this.colors = this.colors.filter(color => color !== this.players.get(sessionId).c);
        this.players.delete(sessionId);
    }

    movePlayer (sessionId: string, data: any) {
        const player = this.players.get(sessionId);
        player.pX = data.pX;
        player.pZ = data.pZ;
    }

    getPlayerColor(): number {
        for (let i = 0; i < this.colorsLength; i++) {
            if (!this.colors.includes(i)) {
                return i;
            }
        }   
        
        return 0;
    }
}

export class StateHandlerRoom extends Room<State> {
    maxClients = 4;

    onCreate (options) {
        this.setState(new State());
        this.state.colorsLength = options.colorsLength;

        this.onMessage("move", (client, data) => {
            this.state.movePlayer(client.sessionId, data);
        });
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin (client: Client, data: any) {
        this.state.createPlayer(client.sessionId, data);
    }

    onLeave (client) {
        this.state.removePlayer(client.sessionId);
    }

    onDispose () {
        console.log("Dispose StateHandlerRoom");
    }

}
