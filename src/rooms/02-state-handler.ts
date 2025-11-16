import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

class Vector2 {
    x: number;
    z: number;
}

const SPAWN_POINTS: Vector2[] = [{x:10, z:10}, {x:-10, z:10}, {x:10, z:-10}, {x:-10, z:-10}]

export class Player extends Schema {
    @type("uint16")
    weapon = 0;
    
    @type("uint16")
    loss = 0;

    @type("uint16")
    health = 0;

    @type("uint16")
    currentHealth = 0;

    @type("number")
    speed = 0;
    
    @type("number")
    pX = 0;

    @type("number")
    pY = 0;

    @type("number")
    pZ = 0;

    @type("number")
    vX = 0;

    @type("number")
    vY = 0;

    @type("number")
    vZ = 0;

    @type("number")
    rX = 0;

    @type("number")
    rY = 0;

    @type("boolean")
    cr = false;
}

export class State extends Schema {
    @type({ map: Player })
    players = new MapSchema<Player>();

    something = "This attribute won't be sent to the client-side";

    createPlayer(sessionId: string, data: any) {
        const player = new Player();
        player.speed = data.speed;
        player.health = data.health;
        player.currentHealth = data.health;
        player.weapon = data.weapon;

        const spawnPosition = SPAWN_POINTS[this.players.size]
        player.pX = spawnPosition.x;
        player.pZ = spawnPosition.z;

        this.players.set(sessionId, player);
    }

    removePlayer(sessionId: string) {
        this.players.delete(sessionId);
    }

    movePlayer (sessionId: string, data: any) {
        const player = this.players.get(sessionId);
        player.pX = data.pX;
        player.pY = data.pY;
        player.pZ = data.pZ;
        player.vX = data.vX;
        player.vY = data.vY;
        player.vZ = data.vZ;
        player.rX = data.rX;
        player.rY = data.rY;
        player.cr = data.cr;
    }

    changeWeaponPlayer (sessionId: string, data: any) {
        const player = this.players.get(sessionId);
        player.weapon = data.weapon;
    }
}

export class StateHandlerRoom extends Room<State> {
    maxClients = 8;

    onCreate (options) {
        console.log("StateHandlerRoom created!", options);

        this.setState(new State());

        this.onMessage("move", (client, data) => {
            this.state.movePlayer(client.sessionId, data);
        });

        this.onMessage("weapon", (client, data) => {
            this.state.changeWeaponPlayer(client.sessionId, data);
        });

        this.onMessage("shoot", (client, data) => {
            this.broadcast("Shoot", data, {except: client});
        });

        this.onMessage("damage", (client, data) => {
            const id = data.id;
            const player = this.state.players.get(id);
            let hp = player.currentHealth - data.value;

            if (hp > 0) {
                player.currentHealth = hp;
                return;
            }

            const rndIndex = Math.floor(Math.random() * SPAWN_POINTS.length);
            const spawnPosition = SPAWN_POINTS[rndIndex];
            const x = spawnPosition.x;
            const z = spawnPosition.z;

            player.loss++;
            player.currentHealth = player.health;

            for(const client of this.clients){
                if (client.id !== id)
                    continue;

                const message = JSON.stringify({x, z, id});
                client.send("Restart", message);
            }
        });
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin (client: Client, data: any) {
        client.send("hello", "world");
        this.state.createPlayer(client.sessionId, data);
    }

    onLeave (client) {
        this.state.removePlayer(client.sessionId);
    }

    onDispose () {
        console.log("Dispose StateHandlerRoom");
    }

}
