type Subscriber<T> = (data: T) => any;
export class Subscribable<T> {
    private readonly subscribers: Subscriber<T>[] = [];
    constructor() { }

    public subscribe(subscriber: Subscriber<T>): Subscriber<T> {
        this.subscribers.push(subscriber);
        if(this.subscribers.length === 1) { this.onHasSubscribers(); }
        return subscriber;
    }

    public unsubscribe(subscriber: Subscriber<T>): void {
        for(let i: number = this.subscribers.length - 1; i>=0; i--) {
            if(subscriber === this.subscribers[i]) {
                this.subscribers.splice(i, 1);
            }
        }
        if(this.subscribers.length === 0) { this.onHasNoSubscribers(); }
    }

    protected forEachSubscriber(callback: (sub: Subscriber<T>, index: number, subscribers: Subscriber<T>[])=>any): void {
        this.subscribers.forEach(callback);
    }

    protected hasSubscribers(): boolean {
        return this.subscribers.length > 0;
    }

    protected onHasSubscribers(): void { }
    protected onHasNoSubscribers(): void { }
}