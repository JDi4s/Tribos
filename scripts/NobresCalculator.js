(function () {
    var SCRIPT_NS = 'nobres_calculator_modern';
    var DIALOG_ID = 'nobres_calculator_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.nobresCalculator; } catch (e) { window.nobresCalculator = undefined; }

    class NobresCalculator {
        static translations() {
            return {
                pt_PT: {
                    title: 'Calculadora de Nobres',
                    subtitle: 'Recursos totais, moedas e próximos nobres',
                    loading: 'A carregar...',
                    loadingWorldConfig: 'A carregar configuração do mundo...',
                    loadingResources: 'A somar recursos de todas as aldeias...',
                    loadingSnob: 'A analisar academia...',
                    loadingIncoming: 'A ler recursos a chegar...',
                    success: 'Calculado com sucesso!',
                    errorFetching: 'Erro ao carregar:',
                    premiumRequired: 'É necessário possuir conta premium para correr este script!',
                    currentGroup: 'Grupo atual',
                    player: 'Jogador',
                    world: 'Mundo',
                    refresh: 'Atualizar',
                    calculate: 'Calcular',
                    copy: 'Copiar resumo',
                    totalResources: 'Recursos totais',
                    incomingResources: 'Recursos a chegar',
                    includeIncoming: 'Incluir recursos a chegar no cálculo',
                    costs: 'Custos usados',
                    results: 'Resultado',
                    nextNoble: 'Próximo nobre',
                    discount: 'Desconto moeda (%)',
                    existingCoins: 'Moedas já cunhadas',
                    coinCost: 'Custo da moeda',
                    snobCost: 'Custo do nobre',
                    affordableNow: 'Nobres possíveis',
                    nextCost: 'Custo do próximo',
                    afterThat: 'Seguinte depois',
                    resourcesLeft: 'Recursos sobrantes',
                    detectionNote: 'Podes ajustar manualmente o próximo nobre, as moedas já cunhadas e o desconto.',
                    credits: 'Calculadora de Nobres by JDi4s',
                    wood: 'Madeira',
                    stone: 'Barro',
                    iron: 'Ferro',
                    coins: 'Moedas',
                    invalidWorldConfig: 'Configuração do mundo inválida.',
                    copied: 'Resumo copiado!'
                },
                en_US: {
                    title: 'Noble Calculator',
                    subtitle: 'Total resources, coins and next nobles',
                    loading: 'Loading...',
                    loadingWorldConfig: 'Loading world config...',
                    loadingResources: 'Summing resources from all villages...',
                    loadingSnob: 'Reading academy...',
                    loadingIncoming: 'Reading incoming resources...',
                    success: 'Calculated successfully!',
                    errorFetching: 'Error while fetching:',
                    premiumRequired: 'A premium account is required to run this script!',
                    currentGroup: 'Current group',
                    player: 'Player',
                    world: 'World',
                    refresh: 'Refresh',
                    calculate: 'Calculate',
                    copy: 'Copy summary',
                    totalResources: 'Total resources',
                    incomingResources: 'Incoming resources',
                    includeIncoming: 'Include incoming resources in calculation',
                    costs: 'Costs used',
                    results: 'Results',
                    nextNoble: 'Next noble',
                    discount: 'Coin discount (%)',
                    existingCoins: 'Minted coins',
                    coinCost: 'Coin cost',
                    snobCost: 'Noble cost',
                    affordableNow: 'Affordable nobles',
                    nextCost: 'Next cost',
                    afterThat: 'After that',
                    resourcesLeft: 'Resources left',
                    detectionNote: 'You can manually adjust next noble, current coins and discount.',
                    credits: 'Noble Calculator by JDi4s',
                    wood: 'Wood',
                    stone: 'Clay',
                    iron: 'Iron',
                    coins: 'Coins',
                    invalidWorldConfig: 'Invalid world configuration.',
                    copied: 'Summary copied!'
                }
            };
        }

        constructor() {
            const allTranslations = NobresCalculator.translations();
            this.t = allTranslations[game_data.locale] || allTranslations.en_US;
            this.worldConfig = null;
            this.worldConfigFileName = `worldConfigFile_${game_data.world}`;
            this.detectedData = null;
            this.totalResources = null;
            this.incomingResources = { wood: 0, stone: 0, iron: 0 };
            this.settingsKey = `nobresCalculatorSettings_${game_data.world}_${game_data.player.id}`;
        }

        async init() {
            if (!game_data.features.Premium.active) {
                UI.ErrorMessage(this.t.premiumRequired);
                return;
            }

            await this.#initWorldConfig();
            await this.#loadData();
            await this.#createUI();
        }

        async #initWorldConfig() {
            let worldConfig = localStorage.getItem(this.worldConfigFileName);

            if (worldConfig === null) {
                UI.InfoMessage(this.t.loadingWorldConfig);
                worldConfig = await this.#getWorldConfig();
            }

            this.worldConfig =
                typeof worldConfig === 'string'
                    ? $.parseXML(worldConfig)
                    : worldConfig;

            try {
                this.worldConfig.getElementsByTagName('config')[0];
            } catch (e) {
                UI.ErrorMessage(this.t.invalidWorldConfig);
                throw e;
            }
        }

        async #getWorldConfig() {
            const xml = this.#fetchHtmlPage('/interface.php?func=get_config');
            const xmlString =
                typeof xml === 'string'
                    ? xml
                    : new XMLSerializer().serializeToString(xml);

            localStorage.setItem(this.worldConfigFileName, xmlString);
            await this.#waitMilliseconds(Date.now(), 200);
            return xmlString;
        }

        async #loadData() {
            UI.InfoMessage(this.t.loadingResources);
            this.totalResources = await this.#getTotalResources();

            UI.InfoMessage(this.t.loadingSnob);
            this.detectedData = await this.#getSnobData();

            UI.InfoMessage(this.t.loadingIncoming);
            this.incomingResources = await this.#getIncomingResources();
        }

        async #waitMilliseconds(lastRunTime, milliseconds = 0) {
            await new Promise(res => {
                setTimeout(res, Math.max((lastRunTime || 0) + milliseconds - Date.now(), 0));
            });
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;

            $.each(extraParams, function (key, value) {
                url += `&${key}=${value}`;
            });

            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
            return url;
        }

        #fetchHtmlPage(url) {
            let tempData = null;
            const self = this;

            $.ajax({
                async: false,
                url: url,
                type: 'GET',
                success: function (data) {
                    tempData = data;
                },
                error: function () {
                    UI.ErrorMessage(`${self.t.errorFetching} ${url}`);
                }
            });

            return tempData;
        }

        async #setMaxLinesPerPage(screen, mode, value) {
            await new Promise(res => setTimeout(res, 200));

            const form = document.createElement("form");
            form.method = "POST";
            form.action = "#";

            $.each({ page_size: value, h: game_data.csrf }, function (key, value) {
                const input = document.createElement('input');
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });

            const dataString = $(form).serialize();

            $.ajax({
                type: 'POST',
                url: this.#generateUrl(screen, mode, { action: 'change_page_size', type: 'all' }),
                data: dataString,
                async: false
            });
        }

        #formatNumber(value) {
            return new Intl.NumberFormat('pt-PT').format(Math.floor(Number(value || 0)));
        }

        #parseNumber(text) {
            return parseInt(String(text || '').replace(/[^\d]/g, ''), 10) || 0;
        }

        #getCurrentGroupName() {
            const html = $.parseHTML(
                this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', { type: 'static' }))
            );

            let groups = $(html).find('.vis_item').find('a,strong');
            const groupsArr = {};

            if ($(groups).length > 0) {
                $.each(groups, function (_, group) {
                    const val = $(group).text().trim();
                    groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1);
                });
            } else {
                groups = $(html).find('.vis_item select option');
                $.each(groups, function (_, group) {
                    groupsArr[(new URLSearchParams($(group).val())).get('group')] = $(group).text().trim();
                });
            }

            return (game_data.group_id && groupsArr[game_data.group_id]) || this.t.currentGroup;
        }

        #getSnobFactor() {
            try {
                const snob = this.worldConfig.getElementsByTagName('snob')[0];
                const factorNode = snob.getElementsByTagName('factor')[0];
                const factor = parseFloat(factorNode.textContent.trim());
                return isNaN(factor) ? 1 : factor;
            } catch (e) {
                return 1;
            }
        }

        #extractResourcesFromTable(table) {
            const totals = { wood: 0, stone: 0, iron: 0 };
            const headerMap = {};

            $(table).find('thead th').each(function (idx) {
                const img = $(this).find('img').attr('src') || '';
                const txt = ($(this).text() || '').toLowerCase();

                if (img.includes('holz') || txt.includes('wood') || txt.includes('madeira')) headerMap.wood = idx;
                if (img.includes('lehm') || txt.includes('clay') || txt.includes('stone') || txt.includes('barro')) headerMap.stone = idx;
                if (img.includes('eisen') || txt.includes('iron') || txt.includes('ferro')) headerMap.iron = idx;
            });

            if (
                headerMap.wood === undefined ||
                headerMap.stone === undefined ||
                headerMap.iron === undefined
            ) {
                return null;
            }

            const rows = $(table).find('tbody tr');
            if (!rows.length) return null;

            rows.each((_, row) => {
                const cells = $(row).find('td');
                totals.wood += this.#parseNumber($(cells.eq(headerMap.wood)).text());
                totals.stone += this.#parseNumber($(cells.eq(headerMap.stone)).text());
                totals.iron += this.#parseNumber($(cells.eq(headerMap.iron)).text());
            });

            return totals;
        }

        async #getTotalResources() {
            const totals = { wood: 0, stone: 0, iron: 0 };
            let currentPage = 0;
            let guard = 0;

            await this.#setMaxLinesPerPage('overview_villages', 'prod', 1000);
            await this.#waitMilliseconds(Date.now(), 250);

            while (guard < 200) {
                guard++;

                const rawPage = this.#fetchHtmlPage(
                    this.#generateUrl('overview_villages', 'prod', { page: currentPage })
                );
                if (!rawPage) break;

                const pageHtml = $.parseHTML(rawPage);

                const possibleTables = [
                    $(pageHtml).find('#production_table'),
                    $(pageHtml).find('#combined_table'),
                    $(pageHtml).find('table.vis')
                ];

                let pageTotals = null;

                for (const tableSet of possibleTables) {
                    if (!tableSet || !tableSet.length) continue;

                    tableSet.each((_, table) => {
                        if (pageTotals) return;

                        const extracted = this.#extractResourcesFromTable($(table));
                        if (!extracted) return;

                        const sum = extracted.wood + extracted.stone + extracted.iron;
                        if (sum > 0) pageTotals = extracted;
                    });

                    if (pageTotals) break;
                }

                if (!pageTotals) break;

                const pageSum = pageTotals.wood + pageTotals.stone + pageTotals.iron;
                if (pageSum === 0) break;

                totals.wood += pageTotals.wood;
                totals.stone += pageTotals.stone;
                totals.iron += pageTotals.iron;

                currentPage++;
                await this.#waitMilliseconds(Date.now(), 200);
            }

            return totals;
        }

        async #getIncomingResources() {
            const totals = { wood: 0, stone: 0, iron: 0 };

            const possiblePages = [
                this.#generateUrl('overview_villages', 'trader', { type: 'inc' }),
                this.#generateUrl('overview_villages', 'trader'),
                this.#generateUrl('market', 'traders')
            ];

            for (const url of possiblePages) {
                const rawPage = this.#fetchHtmlPage(url);
                if (!rawPage) continue;

                const pageHtml = $.parseHTML(rawPage);
                const tables = $(pageHtml).find('table.vis');

                let foundSomething = false;

                tables.each((_, table) => {
                    const tableText = ($(table).text() || '').toLowerCase();

                    const looksRelevant =
                        tableText.includes('holz') ||
                        tableText.includes('lehm') ||
                        tableText.includes('eisen') ||
                        tableText.includes('madeira') ||
                        tableText.includes('barro') ||
                        tableText.includes('ferro') ||
                        tableText.includes('wood') ||
                        tableText.includes('clay') ||
                        tableText.includes('iron');

                    if (!looksRelevant) return;

                    $(table).find('tbody tr').each((__, row) => {
                        let wood = 0;
                        let stone = 0;
                        let iron = 0;

                        $(row).find('td').each((___, cell) => {
                            const cellText = $(cell).text() || '';
                            const cellValue = this.#parseNumber(cellText);
                            const cellHtml = ($(cell).html() || '').toLowerCase();

                            if (cellHtml.includes('holz')) wood += cellValue;
                            if (cellHtml.includes('lehm')) stone += cellValue;
                            if (cellHtml.includes('eisen')) iron += cellValue;
                        });

                        if (wood || stone || iron) {
                            totals.wood += wood;
                            totals.stone += stone;
                            totals.iron += iron;
                            foundSomething = true;
                        }
                    });
                });

                if (foundSomething) return totals;
            }

            return totals;
        }

        async #getSnobData() {
            const html = this.#fetchHtmlPage(this.#generateUrl('snob'));
            const htmlText = typeof html === 'string' ? html : new XMLSerializer().serializeToString(html);
            const factor = this.#getSnobFactor();

            const baseCoinCost = {
                wood: Math.ceil(28000 * factor),
                stone: Math.ceil(30000 * factor),
                iron: Math.ceil(25000 * factor)
            };

            const baseSnobCost = {
                wood: Math.ceil(40000 * factor),
                stone: Math.ceil(50000 * factor),
                iron: Math.ceil(50000 * factor)
            };

            let nextNobleCoins = 1;
            let existingCoins = 0;

            const nextRegexes = [
                /(?:pr[óo]ximo\s+nobre|next\s+noble)[\s\S]{0,120}?(\d+)\s*(?:moedas?|coins?)/i,
                /(?:custa|costs?)[\s\S]{0,120}?(\d+)\s*(?:moedas?|coins?)[\s\S]{0,120}?(?:nobre|noble)/i,
                /(\d+)\s*(?:moedas?|coins?)[\s\S]{0,120}?(?:pr[óo]ximo\s+nobre|next\s+noble)/i,
                /gold_coins?[^0-9]{0,20}(\d+)/i
            ];

            for (const rx of nextRegexes) {
                const m = htmlText.match(rx);
                if (m && m[1]) {
                    nextNobleCoins = parseInt(m[1], 10) || 1;
                    break;
                }
            }

            const coinRegexes = [
                /(?:tens|you have|possuis|owned|minted)[\s\S]{0,80}?(\d+)\s*(?:moedas?|coins?)/i,
                /(?:moedas?\s+já\s+cunhadas|minted\s+coins?)[\s\S]{0,80}?(\d+)/i,
                /gold_coins?[^0-9]{0,20}(\d+)/i
            ];

            for (const rx of coinRegexes) {
                const m = htmlText.match(rx);
                if (m && m[1]) {
                    existingCoins = parseInt(m[1], 10) || 0;
                    break;
                }
            }

            const saved = this.#loadSettings();

            return {
                coinCost: baseCoinCost,
                snobCost: baseSnobCost,
                nextNobleCoins: typeof saved.nextNobleCoins === 'number' ? saved.nextNobleCoins : nextNobleCoins,
                existingCoins: typeof saved.existingCoins === 'number' ? saved.existingCoins : existingCoins,
                discount: typeof saved.discount === 'number' ? saved.discount : 0,
                includeIncoming: typeof saved.includeIncoming === 'boolean' ? saved.includeIncoming : true
            };
        }

        #loadSettings() {
            try {
                const raw = localStorage.getItem(this.settingsKey);
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        }

        #saveSettings(settings) {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
        }

        #getDiscountedCoinCost(coinCost, discountPercent) {
            const multiplier = Math.max(0, 1 - (Number(discountPercent || 0) / 100));

            return {
                wood: Math.ceil(coinCost.wood * multiplier),
                stone: Math.ceil(coinCost.stone * multiplier),
                iron: Math.ceil(coinCost.iron * multiplier)
            };
        }

        #canAfford(resources, cost) {
            return (
                resources.wood >= cost.wood &&
                resources.stone >= cost.stone &&
                resources.iron >= cost.iron
            );
        }

        #calculatePlan(totalResources, coinCost, snobCost, nextNobleCoins, discountPercent, existingCoins = 0) {
            const discountedCoinCost = this.#getDiscountedCoinCost(coinCost, discountPercent);

            let resources = {
                wood: totalResources.wood,
                stone: totalResources.stone,
                iron: totalResources.iron
            };

            let nobles = 0;
            let currentCoinsNeeded = Number(nextNobleCoins || 1);
            let bankedCoins = Number(existingCoins || 0);

            while (true) {
                const missingCoins = Math.max(0, currentCoinsNeeded - bankedCoins);

                const cost = {
                    wood: snobCost.wood + discountedCoinCost.wood * missingCoins,
                    stone: snobCost.stone + discountedCoinCost.stone * missingCoins,
                    iron: snobCost.iron + discountedCoinCost.iron * missingCoins
                };

                if (!this.#canAfford(resources, cost)) break;

                resources.wood -= cost.wood;
                resources.stone -= cost.stone;
                resources.iron -= cost.iron;

                bankedCoins = Math.max(0, bankedCoins - currentCoinsNeeded);
                nobles++;
                currentCoinsNeeded++;
            }

            const nextMissingCoins = Math.max(0, currentCoinsNeeded - bankedCoins);
            const afterMissingCoins = Math.max(0, (currentCoinsNeeded + 1) - bankedCoins);

            const nextCost = {
                wood: snobCost.wood + discountedCoinCost.wood * nextMissingCoins,
                stone: snobCost.stone + discountedCoinCost.stone * nextMissingCoins,
                iron: snobCost.iron + discountedCoinCost.iron * nextMissingCoins
            };

            const afterThatCost = {
                wood: snobCost.wood + discountedCoinCost.wood * afterMissingCoins,
                stone: snobCost.stone + discountedCoinCost.stone * afterMissingCoins,
                iron: snobCost.iron + discountedCoinCost.iron * afterMissingCoins
            };

            return {
                affordableNobles: nobles,
                nextCoinsNeeded: currentCoinsNeeded,
                discountedCoinCost,
                nextCost,
                afterThatCost,
                resourcesLeft: resources,
                remainingBankedCoins: bankedCoins
            };
        }

        #buildSummaryText(plan, detected) {
            return [
                `${this.t.player}: ${game_data.player.name}`,
                `${this.t.world}: ${game_data.world}`,
                `${this.t.currentGroup}: ${this.#getCurrentGroupName()}`,
                '',
                `${this.t.affordableNow}: ${plan.affordableNobles}`,
                `${this.t.nextNoble}: ${plan.nextCoinsNeeded} ${this.t.coins}`,
                `${this.t.discount}: ${detected.discount}%`,
                `${this.t.existingCoins}: ${detected.existingCoins || 0}`,
                `${this.t.includeIncoming}: ${detected.includeIncoming ? 'Sim' : 'Não'}`,
                '',
                `${this.t.nextCost}:`,
                `${this.t.wood}: ${this.#formatNumber(plan.nextCost.wood)}`,
                `${this.t.stone}: ${this.#formatNumber(plan.nextCost.stone)}`,
                `${this.t.iron}: ${this.#formatNumber(plan.nextCost.iron)}`,
                '',
                `${this.t.resourcesLeft}:`,
                `${this.t.wood}: ${this.#formatNumber(plan.resourcesLeft.wood)}`,
                `${this.t.stone}: ${this.#formatNumber(plan.resourcesLeft.stone)}`,
                `${this.t.iron}: ${this.#formatNumber(plan.resourcesLeft.iron)}`
            ].join('\n');
        }

        async #createUI() {
            const detected = this.detectedData;

            const effectiveResources = {
                wood: this.totalResources.wood + (detected.includeIncoming ? this.incomingResources.wood : 0),
                stone: this.totalResources.stone + (detected.includeIncoming ? this.incomingResources.stone : 0),
                iron: this.totalResources.iron + (detected.includeIncoming ? this.incomingResources.iron : 0)
            };

            const plan = this.#calculatePlan(
                effectiveResources,
                detected.coinCost,
                detected.snobCost,
                detected.nextNobleCoins,
                detected.discount,
                detected.existingCoins || 0
            );

            const t = this.t;
            const currentGroupName = this.#getCurrentGroupName();
            const playerName = game_data.player.name;
            const worldName = game_data.world;

            const html = `
<div id="nc-root">
    <div class="nc-shell">
        <div class="nc-header">
            <div class="nc-header-left">
                <div class="nc-kicker">Tribal Wars</div>
                <h3>${t.title}</h3>
                <div class="nc-sub">${t.subtitle}</div>
            </div>
            <div class="nc-header-right">
                <div class="nc-stamp">${playerName}</div>
            </div>
        </div>

        <div class="nc-topbar">
            <div class="nc-meta">
                <div class="nc-pill">
                    <span class="nc-pill-label">${t.currentGroup}</span>
                    <strong>${currentGroupName}</strong>
                </div>
                <div class="nc-pill">
                    <span class="nc-pill-label">${t.player}</span>
                    <strong>${playerName}</strong>
                </div>
                <div class="nc-pill">
                    <span class="nc-pill-label">${t.world}</span>
                    <strong>${worldName}</strong>
                </div>
            </div>

            <div class="nc-actions">
                <button id="nc-refresh" class="nc-btn nc-btn-secondary">${t.refresh}</button>
                <button id="nc-recalc" class="nc-btn nc-btn-primary">${t.calculate}</button>
                <button id="nc-copy-summary" class="nc-btn nc-btn-secondary">${t.copy}</button>
            </div>
        </div>

        <div class="nc-grid">
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
                    <label>${t.nextNoble}</label>
                    <input id="nc-next-noble" type="number" min="1" value="${detected.nextNobleCoins}">
                </div>

                <div class="nc-form-row">
                    <label>${t.existingCoins}</label>
                    <input id="nc-existing-coins" type="number" min="0" value="${detected.existingCoins || 0}">
                </div>

                <div class="nc-form-row">
                    <label>${t.discount}</label>
                    <input id="nc-discount" type="number" min="0" max="100" step="0.1" value="${detected.discount}">
                </div>

                <div class="nc-cost-block">
                    <div class="nc-cost-title">${t.coinCost}</div>
                    <div class="nc-cost-line">${t.wood}: <strong>${this.#formatNumber(plan.discountedCoinCost.wood)}</strong></div>
                    <div class="nc-cost-line">${t.stone}: <strong>${this.#formatNumber(plan.discountedCoinCost.stone)}</strong></div>
                    <div class="nc-cost-line">${t.iron}: <strong>${this.#formatNumber(plan.discountedCoinCost.iron)}</strong></div>
                </div>

                <div class="nc-cost-block">
                    <div class="nc-cost-title">${t.snobCost}</div>
                    <div class="nc-cost-line">${t.wood}: <strong>${this.#formatNumber(detected.snobCost.wood)}</strong></div>
                    <div class="nc-cost-line">${t.stone}: <strong>${this.#formatNumber(detected.snobCost.stone)}</strong></div>
                    <div class="nc-cost-line">${t.iron}: <strong>${this.#formatNumber(detected.snobCost.iron)}</strong></div>
                </div>

                <div class="nc-note">${t.detectionNote}</div>
            </div>
        </div>

        <div class="nc-grid nc-results-grid">
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
                        <div class="nc-result-value">${plan.nextCoinsNeeded} ${t.coins}</div>
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
            <div class="nc-resource-grid">
                ${renderResourceCard('wood', plan.resourcesLeft.wood, t.wood)}
                ${renderResourceCard('stone', plan.resourcesLeft.stone, t.stone)}
                ${renderResourceCard('iron', plan.resourcesLeft.iron, t.iron)}
            </div>
        </div>

        <div class="nc-footer">${t.credits}</div>
    </div>
</div>

<style>
.popup_box_content {
    min-width: 980px;
    background: transparent !important;
}
.mds .popup_box_content {
    min-width: unset !important;
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
    gap: 16px;
    padding: 20px 22px;
    background: linear-gradient(135deg, rgba(88,57,29,.95) 0%, rgba(59,37,20,.97) 100%);
    border-bottom: 1px solid #7c5b36;
}

#nc-root .nc-kicker {
    color: #d6b98a;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .12em;
    margin-bottom: 6px;
}

#nc-root h3 {
    margin: 0;
    font-size: 24px;
    color: #fff3da;
}

#nc-root .nc-sub {
    margin-top: 6px;
    color: #d9c4a0;
    font-size: 12px;
}

#nc-root .nc-stamp {
    background: rgba(0,0,0,.18);
    border: 1px solid rgba(255,255,255,.08);
    color: #f6e7c9;
    padding: 10px 12px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 12px;
    white-space: nowrap;
}

#nc-root .nc-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding: 16px 22px;
    background: rgba(0,0,0,.18);
    border-bottom: 1px solid rgba(255,255,255,.05);
}

#nc-root .nc-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

#nc-root .nc-pill {
    background: linear-gradient(180deg, #3a2819 0%, #2b1d12 100%);
    border: 1px solid #6b4f31;
    border-radius: 999px;
    padding: 8px 12px;
    color: #f2e1c0;
    display: flex;
    gap: 8px;
    align-items: center;
}

#nc-root .nc-pill-label {
    color: #c9ae80;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
}

#nc-root .nc-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
}

#nc-root .nc-btn {
    height: 38px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid #7d5b33;
    cursor: pointer;
    font-weight: 700;
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
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 18px 22px;
}

#nc-root .nc-results-grid {
    grid-template-columns: 1fr 1fr 1fr;
    padding-top: 0;
}

#nc-root .nc-panel {
    background: linear-gradient(180deg, #2d1f14 0%, #21160e 100%);
    border: 1px solid #644a2d;
    border-radius: 16px;
    padding: 16px;
}

#nc-root .nc-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

#nc-root .nc-panel-head h4 {
    margin: 0;
    color: #fff1d5;
    font-size: 16px;
}

#nc-root .nc-resource-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

#nc-root .nc-resource-card {
    background: linear-gradient(180deg, #3a2819 0%, #2a1d13 100%);
    border: 1px solid #62492c;
    border-radius: 14px;
    padding: 12px 8px;
    text-align: center;
}

#nc-root .nc-resource-card img {
    width: 20px;
    height: 20px;
    display: block;
    margin: 0 auto 8px;
}

#nc-root .nc-resource-value {
    font-size: 16px;
    font-weight: 800;
    color: #fff1d7;
}

#nc-root .nc-resource-name {
    margin-top: 4px;
    font-size: 11px;
    color: #cbb186;
}

#nc-root .nc-form-row {
    display: grid;
    grid-template-columns: 1fr 140px;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
}

#nc-root .nc-form-row label {
    color: #e9d8b8;
    font-size: 13px;
}

#nc-root .nc-form-row input {
    height: 36px;
    border-radius: 10px;
    border: 1px solid #6d5231;
    background: #17100b;
    color: #f6e8cb;
    padding: 0 10px;
    box-sizing: border-box;
}

#nc-root .nc-cost-block {
    margin-top: 14px;
    padding: 12px;
    border-radius: 12px;
    background: rgba(0,0,0,.18);
    border: 1px solid rgba(255,255,255,.05);
}

#nc-root .nc-cost-title {
    color: #fff1d5;
    font-weight: 700;
    margin-bottom: 8px;
}

#nc-root .nc-cost-line {
    color: #eadcc0;
    font-size: 13px;
    margin: 4px 0;
}

#nc-root .nc-note {
    margin-top: 14px;
    color: #bfa680;
    font-size: 11px;
}

#nc-root .nc-results-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

#nc-root .nc-result-card {
    background: linear-gradient(180deg, #3a2819 0%, #2a1d13 100%);
    border: 1px solid #62492c;
    border-radius: 14px;
    padding: 14px;
    text-align: center;
}

#nc-root .nc-result-label {
    color: #cbb186;
    font-size: 12px;
}

#nc-root .nc-result-value {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 800;
    color: #fff;
}

#nc-root .nc-leftover {
    margin: 0 22px 18px;
}

#nc-root .nc-footer {
    padding: 0 22px 18px;
    color: #a98d64;
    font-size: 11px;
}

#nc-root .nc-subpanel {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,.08);
}

#nc-root .nc-check-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    color: #eadcc0;
    font-size: 13px;
    cursor: pointer;
}

#nc-root .nc-check-row input[type="checkbox"] {
    transform: scale(1.1);
}

@media (max-width: 980px) {
    .popup_box_content {
        min-width: unset;
    }

    #nc-root .nc-grid,
    #nc-root .nc-results-grid,
    #nc-root .nc-resource-grid,
    #nc-root .nc-results-cards {
        grid-template-columns: 1fr;
    }

    #nc-root .nc-header,
    #nc-root .nc-topbar {
        flex-direction: column;
        align-items: stretch;
    }

    #nc-root .nc-form-row {
        grid-template-columns: 1fr;
    }
}
</style>
`;

            Dialog.show(DIALOG_ID, html, Dialog.close());
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');

            const applyFormValues = async () => {
                const nextNobleCoins = parseInt($('#nc-next-noble').val(), 10) || 1;
                const discount = parseFloat($('#nc-discount').val()) || 0;
                const existingCoins = parseInt($('#nc-existing-coins').val(), 10) || 0;
                const includeIncoming = $('#nc-include-incoming').is(':checked');

                this.detectedData.nextNobleCoins = nextNobleCoins;
                this.detectedData.discount = discount;
                this.detectedData.existingCoins = existingCoins;
                this.detectedData.includeIncoming = includeIncoming;

                this.#saveSettings({
                    nextNobleCoins,
                    discount,
                    existingCoins,
                    includeIncoming
                });

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

            $(document).off('click.' + SCRIPT_NS, '#nc-copy-summary');
            $(document).on('click.' + SCRIPT_NS, '#nc-copy-summary', async () => {
                const nextNobleCoins = parseInt($('#nc-next-noble').val(), 10) || 1;
                const discount = parseFloat($('#nc-discount').val()) || 0;
                const existingCoins = parseInt($('#nc-existing-coins').val(), 10) || 0;
                const includeIncoming = $('#nc-include-incoming').is(':checked');

                const currentResources = {
                    wood: this.totalResources.wood + (includeIncoming ? this.incomingResources.wood : 0),
                    stone: this.totalResources.stone + (includeIncoming ? this.incomingResources.stone : 0),
                    iron: this.totalResources.iron + (includeIncoming ? this.incomingResources.iron : 0)
                };

                const currentPlan = this.#calculatePlan(
                    currentResources,
                    this.detectedData.coinCost,
                    this.detectedData.snobCost,
                    nextNobleCoins,
                    discount,
                    existingCoins
                );

                const summary = this.#buildSummaryText(currentPlan, {
                    nextNobleCoins,
                    discount,
                    existingCoins,
                    includeIncoming
                });

                try {
                    await navigator.clipboard.writeText(summary);
                    UI.SuccessMessage(t.copied, 1500);
                } catch (e) {
                    console.log(summary);
                }
            });

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
