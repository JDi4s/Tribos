(function () {
    var SCRIPT_NS = 'nobres_calculator_debug_popup';
    var DIALOG_ID = 'nobres_calculator_debug_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.nobresCalculatorDebug; } catch (e) { window.nobresCalculatorDebug = undefined; }

    class NobresCalculatorDebug {
        async init() {
            const sections = [];

            sections.push(await this.debugVillageResources());
            sections.push(await this.debugIncoming());
            sections.push(await this.debugSnob());

            this.showResult(sections.join('\n\n' + '='.repeat(80) + '\n\n'));
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

            $.ajax({
                async: false,
                url: url,
                type: 'GET',
                success: function (data) {
                    tempData = data;
                },
                error: function () {
                    tempData = `ERRO AO CARREGAR: ${url}`;
                }
            });

            return tempData;
        }

        #cleanText(text) {
            return String(text || '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        #truncate(text, max = 5000) {
            text = String(text || '');
            return text.length > max ? text.slice(0, max) + '\n...[cortado]...' : text;
        }

        async debugVillageResources() {
            const url = this.#generateUrl('overview_villages', 'prod', { page: 0 });
            const rawPage = this.#fetchHtmlPage(url);

            let out = [];
            out.push('### OVERVIEW PROD');
            out.push('URL: ' + url);

            if (!rawPage || typeof rawPage !== 'string') {
                out.push('Sem HTML válido.');
                return out.join('\n');
            }

            const pageHtml = $.parseHTML(rawPage);
            const tables = $(pageHtml).find('table');

            out.push('Tabelas encontradas: ' + tables.length);

            tables.each((i, table) => {
                const text = this.#truncate(this.#cleanText($(table).text()), 1200);
                out.push(`\n[TABLE ${i}] id=${table.id || '(sem id)'} class=${table.className || '(sem class)'}`);
                out.push(text);
            });

            const prodTable = $(pageHtml).find('#production_table').first();
            if (prodTable.length) {
                out.push('\nHTML #production_table:');
                out.push(this.#truncate(prodTable.prop('outerHTML'), 6000));
            }

            return out.join('\n');
        }

        async debugIncoming() {
            const urls = [
                this.#generateUrl('overview_villages', 'trader', { type: 'inc' }),
                this.#generateUrl('overview_villages', 'trader'),
                this.#generateUrl('market', 'traders')
            ];

            let out = [];
            out.push('### INCOMING');

            for (const url of urls) {
                const rawPage = this.#fetchHtmlPage(url);
                out.push('\nURL: ' + url);

                if (!rawPage || typeof rawPage !== 'string') {
                    out.push('Sem HTML válido.');
                    continue;
                }

                const pageHtml = $.parseHTML(rawPage);
                const tables = $(pageHtml).find('table');

                out.push('Tabelas encontradas: ' + tables.length);

                tables.each((i, table) => {
                    const text = this.#truncate(this.#cleanText($(table).text()), 1200);
                    out.push(`\n[TABLE ${i}] id=${table.id || '(sem id)'} class=${table.className || '(sem class)'}`);
                    out.push(text);
                });

                const firstTable = tables.first();
                if (firstTable.length) {
                    out.push('\nHTML primeira tabela:');
                    out.push(this.#truncate(firstTable.prop('outerHTML'), 6000));
                    break;
                }
            }

            return out.join('\n');
        }

        async debugSnob() {
            const url = this.#generateUrl('snob');
            const rawPage = this.#fetchHtmlPage(url);

            let out = [];
            out.push('### SNOB');
            out.push('URL: ' + url);

            if (!rawPage || typeof rawPage !== 'string') {
                out.push('Sem HTML válido.');
                return out.join('\n');
            }

            const pageHtml = $.parseHTML(rawPage);
            const tables = $(pageHtml).find('table');

            out.push('Tabelas encontradas: ' + tables.length);

            tables.each((i, table) => {
                const text = this.#truncate(this.#cleanText($(table).text()), 1200);
                out.push(`\n[TABLE ${i}] id=${table.id || '(sem id)'} class=${table.className || '(sem class)'}`);
                out.push(text);
            });

            out.push('\nINÍCIO DO HTML SNOB:');
            out.push(this.#truncate(rawPage, 7000));

            return out.join('\n');
        }

        showResult(text) {
            const escaped = String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const html = `
                <div style="padding:12px;">
                    <h3 style="margin:0 0 12px 0;">Debug Nobres</h3>
                    <div style="margin-bottom:10px;">
                        <button id="nc-copy-debug" style="padding:8px 12px;cursor:pointer;">Copiar debug</button>
                    </div>
                    <textarea id="nc-debug-text" style="width:100%;height:420px;box-sizing:border-box;font-family:monospace;">${escaped}</textarea>
                </div>
            `;

            Dialog.show(DIALOG_ID, html);
            $('#popup_box_' + DIALOG_ID).css('width', '980px');

            $(document).off('click.' + SCRIPT_NS, '#nc-copy-debug');
            $(document).on('click.' + SCRIPT_NS, '#nc-copy-debug', async () => {
                const value = $('#nc-debug-text').val();
                try {
                    await navigator.clipboard.writeText(value);
                    UI.SuccessMessage('Debug copiado!', 1500);
                } catch (e) {
                    UI.ErrorMessage('Não foi possível copiar o debug.');
                }
            });
        }
    }

    window.nobresCalculatorDebug = new NobresCalculatorDebug();
    window.nobresCalculatorDebug.init();
})();
