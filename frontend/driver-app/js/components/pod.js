import { escapeHTML } from "../state.js";

export function captureProofOfDelivery(stop, scannedAtStop = false) {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "action-dialog pod-dialog";
        dialog.innerHTML = `<form id="pod-form" method="dialog">
            <button class="dialog-close" type="button" data-pod-close aria-label="Close">×</button>
            <p class="eyebrow">PROOF OF DELIVERY</p>
            <h2>Handed to ${escapeHTML(stop.recipient)}?</h2>
            <p class="dialog-copy">Choose a proof method and capture the handoff.</p>
            <div class="delivery-instructions" role="note"><strong>Customer instructions</strong><span>Instructions are not provided by the delivery service.</span></div>
            <p class="parcel-verified" role="status">${scannedAtStop ? "✓ Parcel scanned and matched to this stop" : "Parcel scan is completed from the active route before arrival."}</p>
            <div class="proof-method-grid" role="group" aria-label="Proof of delivery method">
                <button class="proof-method is-selected" type="button" data-proof-method="photo" aria-pressed="true"><span aria-hidden="true">▧</span><strong>Take delivery photo</strong></button>
                <button class="proof-method" type="button" data-proof-method="signature" aria-pressed="false"><span aria-hidden="true">✎</span><strong>Collect signature</strong></button>
                <button class="proof-method" type="button" data-proof-method="recipient_name" aria-pressed="false"><span aria-hidden="true">✓</span><strong>Recipient name</strong></button>
            </div>
            <input id="proof-method" type="hidden" value="photo">
            <label class="field-label" for="recipient-name">Recipient name (optional)</label>
            <input id="recipient-name" class="text-input" maxlength="120" autocomplete="name" placeholder="Name of person receiving parcel">
            <label class="field-label" for="pod-photo">Take or choose photo</label>
            <input id="pod-photo" class="text-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
            <div class="signature-wrap" hidden>
                <span class="field-label">Draw recipient signature</span>
                <canvas class="signature-pad" width="640" height="280" aria-label="Signature pad"></canvas>
                <button class="text-button" type="button" data-signature-clear>Clear signature</button>
            </div>
            <div id="pod-error" class="form-error" role="alert" hidden></div>
            <div class="dialog-actions">
                <button class="button button-secondary" type="button" data-pod-close>Cancel</button>
                <button class="button button-success" type="submit">Mark delivery successful</button>
            </div>
            <p class="dialog-footnote">Evidence uploads to private MinIO storage; the current database has no POD reference field.</p>
        </form>`;
        document.body.append(dialog);
        const form = dialog.querySelector("#pod-form");
        const method = dialog.querySelector("#proof-method");
        const nameInput = dialog.querySelector("#recipient-name");
        const photoInput = dialog.querySelector("#pod-photo");
        const signatureWrap = dialog.querySelector(".signature-wrap");
        const canvas = dialog.querySelector(".signature-pad");
        const context = canvas.getContext("2d");
        let signed = false;
        let drawing = false;
        let result = null;

        const close = (value = null) => {
            result = value;
            dialog.close();
        };
        const updateMethod = () => {
            signatureWrap.hidden = method.value !== "signature";
            photoInput.hidden = method.value !== "photo";
        };
        const point = (event) => {
            const bounds = canvas.getBoundingClientRect();
            return {
                x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
                y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
            };
        };
        const startDrawing = (event) => {
            drawing = true;
            canvas.setPointerCapture(event.pointerId);
            const position = point(event);
            context.beginPath();
            context.moveTo(position.x, position.y);
        };
        const draw = (event) => {
            if (!drawing) return;
            const position = point(event);
            context.lineWidth = 5;
            context.lineCap = "round";
            context.strokeStyle = "#192823";
            context.lineTo(position.x, position.y);
            context.stroke();
            signed = true;
        };
        const endDrawing = () => { drawing = false; };

        method.addEventListener("change", updateMethod);
        dialog.querySelectorAll("[data-proof-method]").forEach((button) => {
            button.addEventListener("click", () => {
                method.value = button.dataset.proofMethod;
                method.dispatchEvent(new Event("change"));
            });
        });
        updateMethod();
        dialog.querySelectorAll("[data-pod-close]").forEach((button) => {
            button.addEventListener("click", () => close());
        });
        dialog.querySelector("[data-signature-clear]").addEventListener("click", () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            signed = false;
        });
        const syncProofSelection = () => {
            dialog.querySelectorAll("[data-proof-method]").forEach((button) => {
                const selected = button.dataset.proofMethod === method.value;
                button.classList.toggle("is-selected", selected);
                button.setAttribute("aria-pressed", String(selected));
            });
        };
        method.addEventListener("change", syncProofSelection);
        canvas.addEventListener("pointerdown", startDrawing);
        canvas.addEventListener("pointermove", draw);
        canvas.addEventListener("pointerup", endDrawing);
        canvas.addEventListener("pointercancel", endDrawing);
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const error = dialog.querySelector("#pod-error");
            error.hidden = true;
            let file;
            if (method.value === "photo") {
                file = photoInput.files[0];
                if (!file || file.size > 5 * 1024 * 1024) {
                    error.textContent = file ? "Photos must be 5 MB or smaller." : "Add a photo or choose another proof method.";
                    error.hidden = false;
                    return;
                }
                if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                    error.textContent = "Choose a JPEG, PNG, or WebP photo.";
                    error.hidden = false;
                    return;
                }
            } else if (method.value === "signature") {
                if (!signed) {
                    error.textContent = "Ask the recipient to sign in the box, or choose another proof method.";
                    error.hidden = false;
                    return;
                }
                file = await new Promise((done) => canvas.toBlob(done, "image/png"));
                if (!file) {
                    error.textContent = "Could not capture the signature. Please try again.";
                    error.hidden = false;
                    return;
                }
            } else if (!nameInput.value.trim()) {
                error.textContent = "Enter the recipient name or choose another proof method.";
                error.hidden = false;
                return;
            }
            close({
                evidenceType: method.value,
                file,
                recipientName: nameInput.value.trim()
            });
        });
        dialog.addEventListener("close", () => {
            dialog.remove();
            resolve(result);
        }, { once: true });
        dialog.showModal();
    });
}

export function captureException(stop) {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "action-dialog";
        dialog.innerHTML = `<form id="exception-form" method="dialog">
            <button class="dialog-close" type="button" data-exception-close aria-label="Close">×</button>
            <p class="eyebrow">DELIVERY EXCEPTION</p><h2>What happened?</h2>
            <p class="dialog-copy">${escapeHTML(stop.recipient)} · ${escapeHTML(stop.address)}</p>
            <fieldset class="failure-reason-fieldset"><legend class="field-label">Choose a reason</legend>
                <div class="failure-reason-grid">
                    <label class="failure-reason-option"><input name="failure_reason" type="radio" value="recipient_unavailable" checked><span>Recipient unavailable</span></label>
                    <label class="failure-reason-option"><input name="failure_reason" type="radio" value="wrong_address"><span>Wrong address</span></label>
                    <label class="failure-reason-option"><input name="failure_reason" type="radio" value="refused"><span>Delivery refused</span></label>
                    <label class="failure-reason-option"><input name="failure_reason" type="radio" value="other"><span>Other</span></label>
                </div>
            </fieldset>
            <label class="field-label" for="failure-notes">Notes (optional)</label>
            <textarea id="failure-notes" name="failure_notes" class="text-input" maxlength="500" rows="3"></textarea>
            <label class="field-label" for="exception-photo">Photo (optional)</label>
            <input id="exception-photo" name="photo" class="text-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
            <div id="exception-error" class="form-error" role="alert" hidden></div>
            <label class="check-label"><input name="return_to_hub" type="checkbox"><span>Mark order as returned to hub</span></label>
            <section class="return-queue-notice"><strong>Return queue</strong><span>Physical return handoff is not tracked by the current service.</span></section>
            <p class="dialog-footnote">Return dispatch and photo references are not stored in the current database schema.</p>
            <div class="dialog-actions">
                <button class="button button-secondary" type="button" data-exception-close>Cancel</button>
                <button class="button button-primary" type="submit">Save exception</button>
            </div>
        </form>`;
        document.body.append(dialog);
        const form = dialog.querySelector("#exception-form");
        let result = null;
        const syncFailureSelection = () => {
            dialog.querySelectorAll(".failure-reason-option").forEach((option) => {
                option.classList.toggle("is-selected", option.querySelector("input").checked);
            });
        };
        const close = (value = null) => {
            result = value;
            dialog.close();
        };
        dialog.querySelectorAll('[name="failure_reason"]').forEach((input) => {
            input.addEventListener("change", syncFailureSelection);
        });
        syncFailureSelection();
        dialog.querySelectorAll("[data-exception-close]").forEach((button) => {
            button.addEventListener("click", () => close());
        });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const values = new FormData(form);
            const photo = values.get("photo");
            const error = dialog.querySelector("#exception-error");
            if (photo instanceof File && photo.size > 0 && photo.size > 5 * 1024 * 1024) {
                error.textContent = "Exception photos must be 5 MB or smaller.";
                error.hidden = false;
                return;
            }
            if (
                photo instanceof File
                && photo.size > 0
                && !["image/jpeg", "image/png", "image/webp"].includes(photo.type)
            ) {
                error.textContent = "Choose a JPEG, PNG, or WebP photo.";
                error.hidden = false;
                return;
            }
            close({
                failureReason: values.get("failure_reason"),
                failureNotes: values.get("failure_notes").trim(),
                returnToHub: values.has("return_to_hub"),
                photo
            });
        });
        dialog.addEventListener("close", () => {
            dialog.remove();
            resolve(result);
        }, { once: true });
        dialog.showModal();
    });
}
