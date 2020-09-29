export class Mocket {
    private readonly $onOpen = (ev: Event) => {
        if(this.onopen) { this.onopen(ev); }
    }
    private readonly $onClose = (ev: CloseEvent) => {
        if(this.onclose) { this.onclose(ev); }
    }
    private readonly $onError = (ev: Event) => {
        if(this.onerror) { this.onerror(ev); }
    };
    private readonly $onMessage = (ev: MessageEvent|{'data': any}) => {
        if(this.onmessage) { this.onmessage(ev); }
    };


    public constructor(private readonly ws: WebSocket, private readonly doSend: (data: string) => any) {
        this.readyState = this.ws.readyState;
        this.ws.addEventListener('open', this.$onOpen);
        this.ws.addEventListener('close', this.$onClose);
        this.ws.addEventListener('error', this.$onError);
        // this.ws.addEventListener('message', this.$onMessage);
    }

    public readyState: number;
    public onclose: ((ev: CloseEvent) => any) | null;
    public onerror: ((ev: Event) => any) | null;
    public onmessage: ((ev: MessageEvent|{'data':any}) => any) | null;
    public onopen: ((ev: Event) => any) | null;

    public pushData(data: any): void {
        this.$onMessage({ data });
    }

    public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        this.doSend(data as string);
        // this.ws.send(newData);
    }

    public close(code?: number, reason?: string) {
        this.destroy();
    }

    public destroy(): void {
        this.ws.removeEventListener('open', this.$onOpen);
        this.ws.removeEventListener('close', this.$onClose);
        this.ws.removeEventListener('error', this.$onError);
        this.ws.removeEventListener('message', this.$onMessage);
    }
}