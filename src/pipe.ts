import { PipeAgent } from "./pipe-agent";
import { Subscribable } from "./subscribable";

export enum PipeType {
    VALUE = 'value'
};

export class Pipe<T> extends Subscribable<T> {
    // private subscribers: Subscriber<T>[] = [];
    private agent: PipeAgent;

    constructor(private name: string, websocket: WebSocket) {
        super();
        this.agent = new PipeAgent(websocket, this);
        this.agent.subscribe((data: T) => {
            this.forEachSubscriber((sub) => {
                sub(data);
            });
        });
        this.agent.join(this.name);
    }

    public do(opName: string, ...args: any[]) {
        this.agent.do(opName, ...args);
    }

    public close(): void {
        this.agent.close();
    }

    public getName() {
        return this.name;
    }
}