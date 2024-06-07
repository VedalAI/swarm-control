import { Webhook } from "@vermaysha/discord-webhook";

const hook = new Webhook(process.env.DISCORD_WEBHOOK!);
hook.setUsername("Swarm Control");

export function log(message: string) {
    console.error(message);
    hook.setContent(message);
    hook.send().then();
}

export function logImportant(message: string) {
    log(`<@183249892712513536>\n${message}`);
}

export class LogBuilder {
    private constructor() {}

    private data = "";

    public send() {
        log(this.data);
    }

    public sendImportant() {
        logImportant(this.data);
    }

    public add(header: string, content?: any): LogBuilder {
        if (content) {
            let contentStr = content.toString();
            if (contentStr == "[object Object]") contentStr = JSON.stringify(content, null, 4);
            this.data += `### ${header}\n\`\`\`${contentStr}\`\`\`\n`;
        } else {
            this.data += `### ${header}\n`;
        }
        return this;
    }

    public static add(header: string, content?: any): LogBuilder {
        return new LogBuilder().add(header, content);
    }
}
