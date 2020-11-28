import * as ShareDB from 'sharedb';
import { Doc } from "sharedb/lib/client";
import { ADMIN_PIPE_NAME, ClientAddonMethod } from './constants';
import { PipeAgent } from "./pipe-agent";
import { Plumber } from "./plumber";
import { Subscribable } from "./subscribable";


export class Pipe extends Subscribable<any> {
    protected readonly agent: PipeAgent;

    constructor(private readonly name: string, plumber: Plumber) {
        super();
        if(!plumber) { plumber = this as any as Plumber;} // the plumber object itself is a Pipe. If we pass in null, assume this object is the plumber
        this.agent = new PipeAgent(plumber, this);
        this.agent.subscribe((data: any) => {
            this.forEachSubscriber((sub) => {
                sub(data);
            });
        });
        if(this.getName() !== ADMIN_PIPE_NAME) {
            this.agent.join(this.name);
        }
    }

    public async shout(data: any): Promise<void> {
        await this.do('shout', data);
    }
    public createDoc(documentID: string, data: any): Doc {
        const doc = this.agent.getShareDBDoc(documentID);
        this.do('create_sdb_doc', documentID, data);
        return doc;
    }

    public getMethods(): Promise<ClientAddonMethod> {
        return this.agent.getMethods();
    }

    private do(opName: string, ...args: any[]): Promise<any> {
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

    public updateWebsocket(): void {
        this.agent.updateWebsocket();
    }

    public onAuthenticated(): void {
        this.agent.onAuthenticated();
    }
}

export class AdminPipe extends Pipe {
    public setAPIKey(key: string): Promise<boolean> {
        return this.agent.setAPIKey(key);
    }
    public getPipesDoc(): ShareDB.Doc {
        return this.agent.getAllPipesDoc();
    }
}