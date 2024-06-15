import { LogMessage } from "common/types";

export function stringify(logMessage: LogMessage, isFromBackend: boolean) {
    let data = "";

    if (logMessage.important) data += "<@183249892712513536>\n";

    data += `${logMessage.userIdInsecure} | ${logMessage.transactionToken} | ${isFromBackend ? "Backend" : "Extension"}\n`;

    for (const field of logMessage.fields) {
        if (field.content) {
            let contentStr = field.content.toString();
            if (contentStr == "[object Object]") contentStr = JSON.stringify(field.content, null, 4);
            data += `### ${field.header}\n\`\`\`${contentStr}\`\`\`\n`;
        } else {
            data += `### ${field.header}\n`;
        }
    }

    return data;
}
