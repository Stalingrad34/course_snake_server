import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Vector2Float extends Schema {
    @type("number") x: number;
    @type("number") z: number;

    constructor(x: number, z: number) {
        super();
        this.x = x;
        this.z = z;
    }
}

export class Apple extends Schema {
    @type("uint32") id;
    @type(Vector2Float) position;
}

export class Player extends Schema {
    @type("string") nickname = "";
    @type("number") speed = 0;
    @type("uint16") parts = 0;
    @type("uint16") score = 0;
    @type("uint16") color = 0;
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
    gameOverIds: string[] = [];

    createApple(postion: Vector2Float) {
        const appleData = new Apple();
        appleData.id = ++this.appleId;
        appleData.position = postion;
        this.applesData.push(appleData);
    }

    collectApple(player: Player, data: any) {
        const apple = this.applesData.find(a => a.id === data.id);
        if (apple === undefined)
            return;

        apple.position = this.getRandomFieldPoint();
        player.score++;
        player.parts = Math.round(player.score / 3);
    }

    createPlayer(sessionId: string, data: any) {
        const colorIdx = this.getPlayerColor();
        this.colors.push(colorIdx);

        const player = new Player();
        player.nickname = data.nickname;
        player.speed = data.speed;
        player.parts = data.parts;
        player.color = colorIdx;

        const randomPoint = this.getRandomFieldPoint();
        player.pX = randomPoint.x;
        player.pZ = randomPoint.z;

        this.players.set(sessionId, player);
        this.gameOverIds = this.gameOverIds.filter(id => id !== sessionId);
    }

    removePlayer(sessionId: string) {
        if (this.players.has(sessionId)) {
            this.players.delete(sessionId);
        }
    }

    movePlayer (sessionId: string, data: any) {
        const player = this.players.get(sessionId);
        player.pX = data.pX;
        player.pZ = data.pZ;
    }

    gameOver(data) {
        const gameOverData = JSON.parse(data);
        const clientId = gameOverData.id;

        const gameOverId = this.gameOverIds.find(id => id === clientId);
        if (gameOverId !== undefined) {
            return;
        }

        this.gameOverIds.push(clientId)

        this.removePlayer(clientId);

        for (let i = 0; i < gameOverData.parts.length; i++) {
            const position = gameOverData.parts[i];
            this.createApple(position);
        }
    }

    getPlayerColor(): number {
        return Math.floor(Math.random() * this.colorsLength) + 1;
    }

    getRandomFieldPoint(): Vector2Float {
        const x = Math.floor(Math.random() * this.fieldSize) - this.fieldSize / 2;
        const z = Math.floor(Math.random() * this.fieldSize) - this.fieldSize / 2;

        return new Vector2Float(x, z);
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

        this.onMessage("gameOver", (client, data) => {
            this.state.gameOver(data);
        });

        for (let i = 0; i < this.startAppleCount; i++) {
            this.state.createApple(this.state.getRandomFieldPoint());
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
