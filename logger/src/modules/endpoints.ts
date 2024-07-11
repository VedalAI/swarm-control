import { app } from "..";
import { logToDiscord } from "../util/discord";
import { LogMessage, OrderState } from "common/types";
import { getOrderById, getUserById, logToDatabase } from "../util/db";

// prevent replaying completed transactions
const orderStatesCanLog: { [key in OrderState]: boolean } = {
    rejected: false, // completed
    prepurchase: true, // idk some js errors or something
    cancelled: false, // completed
    paid: true, // log timeout response
    failed: true, // log error
    succeeded: false, // completed
};
// allow frontend to send logs for orders that were just completed
// since frontend always finds out about errors after the ebs
const completedOrderLogGracePeriod = 5 * 1000;
const rejectLogsWithNoToken = true;

app.post("/log", async (req, res) => {
    try {
        const logMessage = req.body as LogMessage & { backendToken?: string };
        const isBackendRequest = process.env.PRIVATE_LOGGER_TOKEN == logMessage.backendToken;

        const logDenied = await canLog(logMessage, isBackendRequest);
        if (logDenied) {
            res.status(logDenied.status).send(logDenied.reason);
            return;
        }

        await logToDatabase(logMessage, isBackendRequest);

        if (logMessage.important) {
            logToDiscord(logMessage, isBackendRequest);
        }

        res.sendStatus(200);
    } catch (e: any) {
        console.error("Failed to log");
        console.error(e);
        res.status(500).send("Failed to log");
    }
});

type LogDenied = {
    status: number;
    reason: string;
};
async function canLog(logMessage: LogMessage, isBackendRequest: boolean): Promise<LogDenied | null> {
    if (isBackendRequest) return null;

    if (!logMessage.transactionToken && rejectLogsWithNoToken) return { status: 400, reason: "Invalid transaction token." };

    const claimedUser = await getUserById(logMessage.userIdInsecure);
    if (!claimedUser) {
        return { status: 403, reason: "Invalid user id." };
    }
    if (claimedUser.banned) {
        return { status: 403, reason: "User is banned." };
    }

    const order = await getOrderById(logMessage.transactionToken);
    if (!order || (!orderStatesCanLog[order.state] && Date.now() - order.updatedAt > completedOrderLogGracePeriod)) {
        return { status: 400, reason: "Invalid transaction token." };
    }

    const errorContext: LogMessage = {
        transactionToken: logMessage.transactionToken,
        userIdInsecure: logMessage.userIdInsecure,
        important: true,
        fields: [{ header: "", content: {} }],
    };
    const errorMessage = errorContext.fields[0];

    const user = await getUserById(order.userId);
    if (!user) {
        errorMessage.header = "Tried to log for order whose userId is not in users table";
        errorMessage.content = {
            orderUser: order.userId,
            order: order.id,
            logMessage,
        };
        logToDiscord(errorContext, false);
        logToDatabase(errorContext, false).then();
        return { status: 500, reason: "Invalid user id in transaction." };
    }
    if (user.id != logMessage.userIdInsecure) {
        errorMessage.header = "Someone tried to bamboozle the logger user id check";
        errorMessage.content = {
            claimedUser: logMessage.userIdInsecure,
            orderUser: user.id,
            order: order.id,
            logMessage,
        };
        logToDiscord(errorContext, false);
        logToDatabase(errorContext, false).then();
        return { status: 403, reason: "Invalid user id." };
    }

    if (user.banned) {
        return { status: 403, reason: "User is banned." };
    }

    return null;
}
