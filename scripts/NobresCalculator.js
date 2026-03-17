async #createUI() {
    const detected = this.detectedData;
    const effectiveResources = this.#getCombinedTotals(detected.includeIncoming);

    const plan = this.#calculatePlan(
        effectiveResources,
        detected.coinCost,
        detected.snobCost,
        detected.nextNobleCoins,
        detected.discount
    );

    const t = this.t;

    const html = `
<div id="nc-root">
    <div class="nc-shell">
        <div class="nc-header">
            <div class="nc-header-left">
                <div class="nc-kicker">Tribal Wars</div>
                <h3>${t.title}</h3>
                <div class="nc-sub">${t.subtitle}</div>
            </div>
        </div>

        <div class="nc-topbar">
            <div class="nc-actions">
                <button id="nc-refresh" class="nc-btn nc-btn-secondary">${t.refresh}</button>
                <button id="nc-recalc" class="nc-btn nc-btn-primary">${t.calculate}</button>
            </div>
        </div>

        <div class="nc-grid nc-main-grid">
            <div class="nc-panel">
                <div class="nc-panel-head">
                    <h4>${t.totalResources}</h4>
                </div>

                <div class="nc-resource-grid">
                    ${renderResourceCard('wood', this.totalResources.wood, t.wood)}
                    ${renderResourceCard('stone', this.totalResources.stone, t.stone)}
                    ${renderResourceCard('iron', this.totalResources.iron, t.iron)}
                </div>

                <div class="nc-subpanel">
                    <div class="nc-cost-title">${t.incomingResources}</div>
                    <div class="nc-resource-grid">
                        ${renderResourceCard('wood', this.incomingResources.wood, t.wood)}
                        ${renderResourceCard('stone', this.incomingResources.stone, t.stone)}
                        ${renderResourceCard('iron', this.incomingResources.iron, t.iron)}
                    </div>

                    <label class="nc-check-row">
                        <input id="nc-include-incoming" type="checkbox" ${detected.includeIncoming ? 'checked' : ''}>
                        <span>${t.includeIncoming}</span>
                    </label>
                </div>
            </div>

            <div class="nc-panel">
                <div class="nc-panel-head">
                    <h4>${t.costs}</h4>
                </div>

                <div class="nc-form-row">
                    <label title="${t.nextNobleHint}">${t.nextNoble}</label>
                    <input id="nc-next-noble" type="number" min="0" value="${detected.nextNobleCoins}">
                </div>

                <div class="nc-form-row">
                    <label>${t.existingCoins}</label>
                    <input id="nc-existing-coins" type="number" min="0" value="${detected.existingCoins || 0}">
                </div>

                <div class="nc-form-row">
                    <label>${t.discount}</label>
                    <input id="nc-discount" type="number" min="0" max="100" step="0.1" value="${detected.discount}">
                </div>

                <div class="nc-cost-block nc-inline-blocks">
                    <div class="nc-cost-mini">
                        <div class="nc-cost-title">${t.coinCost}</div>
                        <div class="nc-cost-line">${t.wood}: <strong>${this.#formatNumber(plan.discountedCoinCost.wood)}</strong></div>
                        <div class="nc-cost-line">${t.stone}: <strong>${this.#formatNumber(plan.discountedCoinCost.stone)}</strong></div>
                        <div class="nc-cost-line">${t.iron}: <strong>${this.#formatNumber(plan.discountedCoinCost.iron)}</strong></div>
                    </div>

                    <div class="nc-cost-mini">
                        <div class="nc-cost-title">${t.snobCost}</div>
                        <div class="nc-cost-line">${t.wood}: <strong>${this.#formatNumber(detected.snobCost.wood)}</strong></div>
                        <div class="nc-cost-line">${t.stone}: <strong>${this.#formatNumber(detected.snobCost.stone)}</strong></div>
                        <div class="nc-cost-line">${t.iron}: <strong>${this.#formatNumber(detected.snobCost.iron)}</strong></div>
                    </div>
                </div>

                <div class="nc-cost-block">
                    <div class="nc-cost-title">${t.missingCoins}</div>
                    <div class="nc-cost-line"><strong>${this.#formatNumber(detected.missingCoinsForNextNoble || 0)}</strong></div>
                </div>
            </div>
        </div>

        <div class="nc-grid nc-bottom-grid">
            <div class="nc-panel">
                <div class="nc-panel-head">
                    <h4>${t.results}</h4>
                </div>

                <div class="nc-results-cards">
                    <div class="nc-result-card">
                        <div class="nc-result-label">${t.affordableNow}</div>
                        <div class="nc-result-value">${plan.affordableNobles}</div>
                    </div>
                    <div class="nc-result-card">
                        <div class="nc-result-label">${t.nextNoble}</div>
                        <div class="nc-result-value">${detected.nextNobleCoins} ${t.coins}</div>
                    </div>
                </div>
            </div>

            <div class="nc-panel">
                <div class="nc-panel-head">
                    <h4>${t.nextCost}</h4>
                </div>
                <div class="nc-cost-line">${t.wood}: <strong>${this.#formatNumber(plan.nextCost.wood)}</strong></div>
                <div class="nc-cost-line">${t.stone}: <strong>${this.#formatNumber(plan.nextCost.stone)}</strong></div>
                <div class="nc-cost-line">${t.iron}: <strong>${this.#formatNumber(plan.nextCost.iron)}</strong></div>
            </div>

            <div class="nc-panel">
                <div class="nc-panel-head">
                    <h4>${t.afterThat}</h4>
                </div>
                <div class="nc-cost-line">${t.wood}: <strong>${this.#formatNumber(plan.afterThatCost.wood)}</strong></div>
                <div class="nc-cost-line">${t.stone}: <strong>${this.#formatNumber(plan.afterThatCost.stone)}</strong></div>
                <div class="nc-cost-line">${t.iron}: <strong>${this.#formatNumber(plan.afterThatCost.iron)}</strong></div>
            </div>
        </div>

        <div class="nc-panel nc-leftover">
            <div class="nc-panel-head">
                <h4>${t.resourcesLeft}</h4>
            </div>
            <div class="nc-resource-grid nc-resource-grid-wide">
                ${renderResourceCard('wood', plan.resourcesLeft.wood, t.wood)}
                ${renderResourceCard('stone', plan.resourcesLeft.stone, t.stone)}
                ${renderResourceCard('iron', plan.resourcesLeft.iron, t.iron)}
            </div>
        </div>

        <div class="nc-footer">${t.credits}</div>
    </div>
</div>

<style>
#popup_box_${DIALOG_ID} {
    width: 930px !important;
}

#popup_box_${DIALOG_ID} .popup_box_content {
    width: 930px !important;
    min-width: 930px !important;
    max-height: none !important;
    overflow: hidden !important;
    background: transparent !important;
    padding: 0 !important;
}

#nc-root {
    color: #f3e9d2;
    font-family: Arial, sans-serif;
}

#nc-root .nc-shell {
    background: linear-gradient(180deg, rgba(34,24,17,.96) 0%, rgba(23,16,11,.98) 100%);
    border: 1px solid #6d5231;
    border-radius: 18px;
    box-shadow: 0 18px 45px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
    overflow: hidden;
}

#nc-root .nc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    background: linear-gradient(135deg, rgba(88,57,29,.95) 0%, rgba(59,37,20,.97) 100%);
    border-bottom: 1px solid #7c5b36;
}

#nc-root .nc-kicker {
    color: #d6b98a;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .12em;
    margin-bottom: 4px;
}

#nc-root h3 {
    margin: 0;
    font-size: 18px;
    color: #fff3da;
}

#nc-root .nc-sub {
    margin-top: 4px;
    color: #d9c4a0;
    font-size: 11px;
}

#nc-root .nc-topbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    background: rgba(0,0,0,.18);
    border-bottom: 1px solid rgba(255,255,255,.05);
}

#nc-root .nc-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

#nc-root .nc-btn {
    height: 34px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid #7d5b33;
    cursor: pointer;
    font-weight: 700;
    font-size: 12px;
    transition: .15s ease;
}

#nc-root .nc-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.04);
}

#nc-root .nc-btn-secondary {
    background: linear-gradient(180deg, #4d3723 0%, #372517 100%);
    color: #f5e6c8;
}

#nc-root .nc-btn-primary {
    background: linear-gradient(180deg, #b8863b 0%, #8d6228 100%);
    color: #fff8ea;
    border-color: #c89b53;
}

#nc-root .nc-grid {
    display: grid;
    gap: 14px;
    padding: 14px 18px;
}

#nc-root .nc-main-grid {
    grid-template-columns: 1fr 1fr;
    padding-bottom: 10px;
}

#nc-root .nc-bottom-grid {
    grid-template-columns: 1.05fr 1fr 1fr;
    padding-top: 0;
    padding-bottom: 10px;
}

#nc-root .nc-panel {
    background: linear-gradient(180deg, #2d1f14 0%, #21160e 100%);
    border: 1px solid #644a2d;
    border-radius: 16px;
    padding: 14px;
}

#nc-root .nc-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

#nc-root .nc-panel-head h4 {
    margin: 0;
    color: #fff1d5;
    font-size: 15px;
}

#nc-root .nc-resource-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

#nc-root .nc-resource-grid-wide {
    gap: 10px;
}

#nc-root .nc-resource-card {
    background: linear-gradient(180deg, #3a2819 0%, #2a1d13 100%);
    border: 1px solid #62492c;
    border-radius: 14px;
    padding: 10px 8px;
    text-align: center;
    min-height: 70px;
    box-sizing: border-box;
}

#nc-root .nc-resource-card img {
    width: 18px;
    height: 18px;
    display: block;
    margin: 0 auto 6px;
}

#nc-root .nc-resource-value {
    font-size: 14px;
    font-weight: 800;
    color: #fff1d7;
    line-height: 1.2;
}

#nc-root .nc-resource-name {
    margin-top: 3px;
    font-size: 10px;
    color: #cbb186;
}

#nc-root .nc-form-row {
    display: grid;
    grid-template-columns: 1fr 160px;
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
}

#nc-root .nc-form-row label {
    color: #e9d8b8;
    font-size: 12px;
}

#nc-root .nc-form-row input {
    height: 32px;
    border-radius: 10px;
    border: 1px solid #6d5231;
    background: #17100b;
    color: #f6e8cb;
    padding: 0 10px;
    box-sizing: border-box;
    font-size: 12px;
}

#nc-root .nc-inline-blocks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

#nc-root .nc-cost-mini {
    margin: 0;
    padding: 0;
}

#nc-root .nc-cost-block {
    margin-top: 10px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(0,0,0,.18);
    border: 1px solid rgba(255,255,255,.05);
}

#nc-root .nc-cost-title {
    color: #fff1d5;
    font-weight: 700;
    margin-bottom: 6px;
    font-size: 12px;
}

#nc-root .nc-cost-line {
    color: #eadcc0;
    font-size: 12px;
    margin: 3px 0;
    line-height: 1.2;
}

#nc-root .nc-note {
    margin-top: 10px;
    color: #bfa680;
    font-size: 10px;
    line-height: 1.25;
}

#nc-root .nc-subpanel {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,.08);
}

#nc-root .nc-check-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    color: #eadcc0;
    font-size: 12px;
    cursor: pointer;
}

#nc-root .nc-check-row input[type="checkbox"] {
    transform: scale(1.05);
}

#nc-root .nc-results-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

#nc-root .nc-result-card {
    background: linear-gradient(180deg, #3a2819 0%, #2a1d13 100%);
    border: 1px solid #62492c;
    border-radius: 14px;
    padding: 12px 10px;
    text-align: center;
}

#nc-root .nc-result-label {
    color: #cbb186;
    font-size: 11px;
    line-height: 1.2;
}

#nc-root .nc-result-value {
    margin-top: 6px;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
    line-height: 1.15;
}

#nc-root .nc-leftover {
    margin: 0 18px 12px;
}

#nc-root .nc-footer {
    padding: 0 18px 14px;
    color: #a98d64;
    font-size: 10px;
}

@media (max-width: 980px) {
    #popup_box_${DIALOG_ID},
    #popup_box_${DIALOG_ID} .popup_box_content {
        width: 94vw !important;
        min-width: 94vw !important;
    }

    #nc-root .nc-main-grid,
    #nc-root .nc-bottom-grid,
    #nc-root .nc-resource-grid,
    #nc-root .nc-results-cards,
    #nc-root .nc-inline-blocks {
        grid-template-columns: 1fr;
    }

    #nc-root .nc-form-row {
        grid-template-columns: 1fr;
    }
}
</style>
`;

            Dialog.show(DIALOG_ID, html);

            const applyFormValues = async () => {
                const nextNobleCoins = parseInt($('#nc-next-noble').val(), 10) || 0;
                const discount = parseFloat($('#nc-discount').val()) || 0;
                const existingCoins = parseInt($('#nc-existing-coins').val(), 10) || 0;
                const includeIncoming = $('#nc-include-incoming').is(':checked');

                this.detectedData.nextNobleCoins = nextNobleCoins;
                this.detectedData.discount = discount;
                this.detectedData.existingCoins = existingCoins;
                this.detectedData.includeIncoming = includeIncoming;

                await this.#createUI();
            };

            const bindApplyOnBlurOrEnter = (selector) => {
                $(document).off('blur.' + SCRIPT_NS, selector);
                $(document).on('blur.' + SCRIPT_NS, selector, applyFormValues);

                $(document).off('keydown.' + SCRIPT_NS, selector);
                $(document).on('keydown.' + SCRIPT_NS, selector, async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        await applyFormValues();
                    }
                });
            };

            bindApplyOnBlurOrEnter('#nc-next-noble');
            bindApplyOnBlurOrEnter('#nc-discount');
            bindApplyOnBlurOrEnter('#nc-existing-coins');

            $(document).off('change.' + SCRIPT_NS, '#nc-include-incoming');
            $(document).on('change.' + SCRIPT_NS, '#nc-include-incoming', applyFormValues);

            $(document).off('click.' + SCRIPT_NS, '#nc-refresh');
            $(document).on('click.' + SCRIPT_NS, '#nc-refresh', async () => {
                try { Dialog.close(); } catch (e) {}
                await this.#loadData();
                await this.#createUI();
            });

            $(document).off('click.' + SCRIPT_NS, '#nc-recalc');
            $(document).on('click.' + SCRIPT_NS, '#nc-recalc', applyFormValues);

            UI.SuccessMessage(t.success, 500);

            function renderResourceCard(resource, value, label) {
                const iconMap = {
                    wood: 'holz',
                    stone: 'lehm',
                    iron: 'eisen'
                };

                return `
                    <div class="nc-resource-card">
                        <img src="/graphic/${iconMap[resource]}.png" alt="${resource}">
                        <div class="nc-resource-value">${new Intl.NumberFormat('pt-PT').format(Math.floor(Number(value || 0)))}</div>
                        <div class="nc-resource-name">${label}</div>
                    </div>
                `;
            }
        }
    }

    window.nobresCalculator = new NobresCalculator();
    window.nobresCalculator.init();
})();
