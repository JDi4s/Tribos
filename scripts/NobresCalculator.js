(function () {
    var SCRIPT_NS = 'nobres_calculator_debug';
    var DIALOG_ID = 'nobres_calculator_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.nobresCalculator; } catch (e) { window.nobresCalculator = undefined; }

    class NobresCalculator {
        constructor() {
            this.villageResources = {};
            this.incomingResByVillage = {};
        }

        async init() {
            console.clear();
            console.log('=== NOBRES DEBUG START ===');

            await this.debugVillageResources();
            await this.debugIncoming();
            await this.debugSnob();

            UI.SuccessMessage('Debug enviado para a consola (F12).', 3000);
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
                    console.log('ERRO AO CARREGAR', url);
                }
            });

            return tempData;
        }

        async debugVillageResources() {
            const url = this.#generateUrl('overview_villages', 'prod', { page: 0 });
            const rawPage = this.#fetchHtmlPage(url);

            console.log('--- OVERVIEW PROD URL ---');
            console.log(url);

            if (!rawPage) {
                console.log('SEM HTML DA OVERVIEW');
                return;
            }

            const pageHtml = $.parseHTML(rawPage);
            const tables = $(pageHtml).find('table');
            console.log('--- TABLES ENCONTRADAS NA OVERVIEW ---');
            console.log('Quantidade:', tables.length);

            tables.each((i, table) => {
                const text = ($(table).text() || '').trim().replace(/\s+/g, ' ').slice(0, 800);
                console.log(`TABLE ${i}`, table.id || '(sem id)', table.className || '(sem class)');
                console.log(text);
            });

            const firstTable = tables.eq(0);
            if (firstTable.length) {
                console.log('--- HTML PRIMEIRA TABELA OVERVIEW ---');
                console.log(firstTable.prop('outerHTML'));
            }
        }

        async debugIncoming() {
            const urls = [
                this.#generateUrl('overview_villages', 'trader', { type: 'inc' }),
                this.#generateUrl('overview_villages', 'trader'),
                this.#generateUrl('market', 'traders')
            ];

            for (const url of urls) {
                const rawPage = this.#fetchHtmlPage(url);

                console.log('--- INCOMING URL ---');
                console.log(url);

                if (!rawPage) {
                    console.log('SEM HTML');
                    continue;
                }

                const pageHtml = $.parseHTML(rawPage);
                const tables = $(pageHtml).find('table');

                console.log('TABLES ENCONTRADAS:', tables.length);

                tables.each((i, table) => {
                    const text = ($(table).text() || '').trim().replace(/\s+/g, ' ').slice(0, 800);
                    console.log(`INCOMING TABLE ${i}`, table.id || '(sem id)', table.className || '(sem class)');
                    console.log(text);
                });

                if (tables.length) {
                    console.log('--- HTML PRIMEIRA TABELA INCOMING ---');
                    console.log(tables.eq(0).prop('outerHTML'));
                    break;
                }
            }
        }

        async debugSnob() {
            const url = this.#generateUrl('snob');
            const rawPage = this.#fetchHtmlPage(url);

            console.log('--- SNOB URL ---');
            console.log(url);

            if (!rawPage) {
                console.log('SEM HTML DA ACADEMIA');
                return;
            }

            const htmlText = typeof rawPage === 'string'
                ? rawPage
                : new XMLSerializer().serializeToString(rawPage);

            console.log('--- TRECHO HTML SNOB (INÍCIO) ---');
            console.log(htmlText.slice(0, 5000));

            const pageHtml = $.parseHTML(rawPage);
            const tables = $(pageHtml).find('table');

            console.log('--- TABLES ENCONTRADAS NA ACADEMIA ---');
            console.log('Quantidade:', tables.length);

            tables.each((i, table) => {
                const text = ($(table).text() || '').trim().replace(/\s+/g, ' ').slice(0, 800);
                console.log(`SNOB TABLE ${i}`, table.id || '(sem id)', table.className || '(sem class)');
                console.log(text);
            });
        }
    }

    window.nobresCalculator = new NobresCalculator();
    window.nobresCalculator.init();
})();
