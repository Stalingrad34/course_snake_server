import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Vector2Float extends Schema {
    @type("number") x: number;
    @type("number") z: number;
}

export class Apple extends Schema {
    @type("uint32") id;
    @type(Vector2Float) position;
}

export class Player extends Schema {
    @type("number") speed = 0;
    @type("uint16") p = 0; //parts
    @type("uint16") s = 0; //score
    @type("uint16") c = 0; //color
    @type("number") pX = 0;
    @type("number") pZ = 0;
}

export class State extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type([Apple]) applesData = new ArraySchema<Apple>();

    colorsLength: number;
    spawnPointsLength: number;
    colors: number[] = [];
    fieldSize = 40;
    appleId = 0;

    createApple() {
        const appleData = new Apple();
        appleData.id = ++this.appleId;
        appleData.position = this.getRandomFieldPoint();
        this.applesData.push(appleData);
    }

    collectApple(player: Player, data: any) {
        const apple = this.applesData.find(a => a.id === data.id);
        if (apple === undefined)
            return;

        apple.position = this.getRandomFieldPoint();
        player.s++;
        player.p = Math.round(player.s / 3);
    }

    createPlayer(sessionId: string, data: any) {
        const colorIdx = this.getPlayerColor();
        this.colors.push(colorIdx);

        const player = new Player();
        player.speed = data.speed;
        player.p = data.parts;
        player.c = colorIdx;

        const randomPoint = this.getRandomFieldPoint();
        player.pX = randomPoint.x;
        player.pZ = randomPoint.z;

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

    getRandomFieldPoint(): Vector2Float {
        const point = new Vector2Float();
        point.x = Math.floor(Math.random() * this.fieldSize) - this.fieldSize / 2;
        point.z = Math.floor(Math.random() * this.fieldSize) - this.fieldSize / 2;

        return point;
    }
}

export class StateHandlerRoom extends Room<State> {
    maxClients = 4;
    startAppleCount = 100;

    onCreate (options) {
        this.setState(new State());
        this.state.colorsLength = options.colorsLength;

        this.onMessage("move", (client, data) => {
            this.state.movePlayer(client.sessionId, data);
        });

        this.onMessage("collect", (client, data) => {
            const player = this.state.players.get(client.sessionId);
            this.state.collectApple(player, data);
        });

        for (let i = 0; i < this.startAppleCount; i++) {
            this.state.createApple();
        }
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
