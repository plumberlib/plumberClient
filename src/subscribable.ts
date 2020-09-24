type Subscriber<T> = (data: T) => any;
export class Subscribable<T> {
    private subscribers: Subscriber<T>[] = [];
    constructor() {

    }

    public subscribe(subscriber: Subscriber<T>): void {
        this.subscribers.push(subscriber);
    }

    public unsubscribe(subscriber: Subscriber<T>): void {
        for(let i: number = this.subscribers.length - 1; i>=0; i--) {
            if(subscriber === this.subscribers[i]) {
                this.subscribers.splice(i, 1);
            }
        }
    }

    protected forEachSubscriber(callback: (sub: Subscriber<T>, index: number, subscribers: Subscriber<T>[])=>any): void {
        this.subscribers.forEach(callback);
    }
}