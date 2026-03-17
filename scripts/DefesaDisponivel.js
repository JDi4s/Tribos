javascript:(async function(){

if (typeof villagesTroopsCounter !== 'undefined') {
    villagesTroopsCounter.init();
    return;
}

class CustomCounter extends VillagesTroopsCounter {

    async #sendToDiscord(totalTroops){
        const playerName = game_data.player.name;

        const embed = {
            content: `**Defesa Total (Casa + Buscas)**\nJogador: ${playerName}`,
            embeds: [{
                title: "🛡️ TROPA DEFENSIVA TOTAL",
                fields: [
                    { name: "Lanceiros", value: `${totalTroops.spear}`, inline: true },
                    { name: "Espadachins", value: `${totalTroops.sword}`, inline: true },
                    { name: "Batedores", value: `${totalTroops.spy}`, inline: true },
                    { name: "Pesada", value: `${totalTroops.heavy}`, inline: true },
                    { name: "Catapultas", value: `${totalTroops.catapult}`, inline: true },
                    { name: "Paladino", value: `${totalTroops.knight}`, inline: true }
                ]
            }]
        };

        $.ajax({
            url: webhookURL,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(embed),
            success: () => UI.SuccessMessage('Enviado para Discord!'),
            error: () => UI.ErrorMessage('Erro ao enviar Discord')
        });
    }

    async #injectButton(total){
        setTimeout(()=>{
            $('#sendDiscordBtn').remove();

            $('.popup_box_content').append(`
                <div style="text-align:center;margin-top:15px;">
                    <button id="sendDiscordBtn" class="btn">
                        📤 Enviar Defesa para Discord
                    </button>
                </div>
            `);

            $('#sendDiscordBtn').click(()=>{
                this.#sendToDiscord(total);
            });

        },500);
    }

    async init(){
        if (!game_data.features.Premium.active){
            UI.ErrorMessage("Precisas de premium.");
            return;
        }

        await this.#initWorldConfig();

        const troopsObj = this.isScavengingWorld 
            ? await this.#getTroopsScavengingWorldObj() 
            : await this.#getTroopsNonScavengingWorldObj();

        const total = {};

        Object.keys(troopsObj.villagesTroops).forEach(unit=>{
            total[unit] = troopsObj.villagesTroops[unit] + troopsObj.scavengingTroops[unit];
        });

        await this.#createUI();

        this.#injectButton(total);
    }
}

var villagesTroopsCounter = new CustomCounter();
villagesTroopsCounter.init();

})();
