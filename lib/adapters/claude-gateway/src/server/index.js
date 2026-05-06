export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
function readNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
export const sessionCodec = {
    deserialize(raw) {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw))
            return null;
        const record = raw;
        const sessionId = readNonEmptyString(record.sessionId) ?? readNonEmptyString(record.session_id);
        if (!sessionId)
            return null;
        const cwd = readNonEmptyString(record.cwd) ??
            readNonEmptyString(record.workdir) ??
            readNonEmptyString(record.folder);
        const workspaceId = readNonEmptyString(record.workspaceId) ?? readNonEmptyString(record.workspace_id);
        const repoUrl = readNonEmptyString(record.repoUrl) ?? readNonEmptyString(record.repo_url);
        const repoRef = readNonEmptyString(record.repoRef) ?? readNonEmptyString(record.repo_ref);
        return {
            sessionId,
            ...(cwd ? { cwd } : {}),
            ...(workspaceId ? { workspaceId } : {}),
            ...(repoUrl ? { repoUrl } : {}),
            ...(repoRef ? { repoRef } : {}),
        };
    },
    serialize(session) {
        if (!session)
            return null;
        return {
            sessionId: session.sessionId,
            ...(session.cwd ? { cwd: session.cwd } : {}),
            ...(session.workspaceId ? { workspaceId: session.workspaceId } : {}),
            ...(session.repoUrl ? { repoUrl: session.repoUrl } : {}),
            ...(session.repoRef ? { repoRef: session.repoRef } : {}),
        };
    },
};
//# sourceMappingURL=index.js.map