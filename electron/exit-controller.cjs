// The renderer confirms only after local saves (and optional sync) finish.
// Keep close requests pending without restarting that work on repeated app.quit().
function createExitController(getWindow) {
    let pending = false;
    let approved = false;
    let afterApproval = null;

    function cancel() {
        pending = false;
        approved = false;
        afterApproval = null;
    }

    function handleClose(event) {
        if (approved) return;
        event.preventDefault();
        if (pending) return;
        const window = getWindow();
        if (!window || window.isDestroyed()) return;
        pending = true;
        try {
            window.webContents.send('confirm-exit-sync');
        } catch (error) {
            cancel();
            throw error;
        }
    }

    function request(afterSave = null) {
        const window = getWindow();
        if (!window || window.isDestroyed() || approved) return false;
        // One pending installer/action is enough even if the user clicks twice.
        if (afterSave && !afterApproval) afterApproval = afterSave;
        window.close();
        return true;
    }

    function approve() {
        if (!pending) return false;
        pending = false;
        approved = true;
        const action = afterApproval;
        afterApproval = null;
        try {
            if (action) action();
            else getWindow()?.close();
        } catch (error) {
            cancel();
            throw error;
        }
        return true;
    }

    function approveNativeExit() {
        // Only for an explicit main-process crash/restart dialog choice, where
        // the failed renderer cannot complete a save/confirmation handshake.
        cancel();
        approved = true;
    }

    return { handleClose, request, approve, cancel, approveNativeExit };
}

module.exports = { createExitController };
