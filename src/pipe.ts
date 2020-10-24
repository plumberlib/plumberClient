import { Doc } from "sharedb/lib/client";
import { PipeAgent } from "./pipe-agent";
import { Plumber } from "./plumber";
import { Subscribable } from "./subscribable";

export interface ClientAddonMethod {
    name: string,
    description?: string,
}

export class Pipe<T> extends Subscribable<T> {
    // private subscribers: Subscriber<T>[] = [];
    private readonly agent: PipeAgent;

    constructor(private readonly name: string, plumber: Plumber) {
        super();
        this.agent = new PipeAgent(plumber, this);
        this.agent.subscribe((data: T) => {
            this.forEachSubscriber((sub) => {
                sub(data);
            });
        });
        this.agent.join(this.name);
    }

    public getMethods(): Promise<ClientAddonMethod> {
        return this.agent.getMethods();
    }

    public do(opName: string, ...args: any[]): Promise<any> {
        return this.agent.do(opName, ...args);
    }

    public getDoc(documentID: string): Doc {
        return this.agent.getShareDBDoc(documentID);
    }

    public close(): void {
        this.agent.close();
    }

    public getName() {
        return this.name;
    }
}