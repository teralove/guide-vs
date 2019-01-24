String.prototype.clr = function (hexColor) { return `<font color='#${hexColor}'>${this}</font>` };

module.exports = function VSGuide(mod) {	
    const mapIDs = [9781, 9981]; 

    // BossAction[TempalateId][Skill.id]
    const BossActions = {
        // Darkan
        1000: {
            1113: {msg: 'Front + AoEs'},    
            1304: {func: DarkanInOutRange},        
        },     
        // Dakuryon
        2000: {
            1134: {msg: 'Pull + Smash'},
        },
        // Lakan
        3000: {
            //1101: {msg: 'Auto'},
            1116: {msg: 'Wave'}, //1116, 1132
            
            1136: {msg: 'Claw'},
            1138: {func: BegoneRange}, // Begone
            1148: {msg: 'Barrage'},
            1152: {msg: 'Stun + Back'},
            1144: {msg: 'Get Out'}, 
            1145: {msg: 'Get In'},
            
            1240: {msg: 'Donuts'},
            1401: {msg: 'Plague/Regress'},     // Shield normal to inverse
            1402: {msg: 'Sleep'},              // Shield inverse to normal
            1701: {msg: "Back + Stab"},
            
            // Normal
            1404: {msg: '(Debuffs) Closest',           next: 3103,    prev: 1301},
            3103: {msg: '(Circles) Spread',            next: 1301,    prev: 1404},
            1301: {msg: '(Bombs) Gather + cleanse',    next: 1404,    prev: 3103},
            // Inversed
            1405: {msg: '(Debuffs) Farthest',          next: 3105,    prev: 1302},
            3105: {msg: '(Circles) Gather',            next: 1302,    prev: 1405},
            1302: {msg: '(Bombs) Gather + no cleanse', next: 1405,    prev: 3105},
        },
    }

    //MessageId: BossAction
    const BossMessages = {
        1043: 1404,   // Lakan has noticed you.
        1044: 3103,   // Lakan is trying to take you on one at a time.	
        1045: 1301,   // Lakan intends to kill all of you at once.
        1046: {msg: 'First: (Debuffs) Closest'},         // Thank you... for this release...
        1047: {msg: 'First: (Circles) Spread'},          // Beware the... red lightning...
        1048: {msg: 'First: (Bombs) Gather + cleanse'},  // Beware the mark... of Lakan...            
    }
        
    // Lakan stuff  
    const InversedAction = {
        1404: 1405,
        3103: 3105,
        1301: 1302,
        1405: 1404,
        3105: 3103,
        1302: 1301
    }  
    
    const LakanNextMessageDelay = 4000;
    const ShieldWarningTime = 80000; //ms
    const ShieldWarningMessage = 'Ring soon';
    const LakanLaserSafespots = [18, 54, 90, 126, 162, 198, 234, 270, 306, 342];
    const LakanLaserNormalDangerOne = [0, 72, 144, 216, 288];
    const LakanLaserInvertedDangerOne = [36, 108, 180, 252, 324];
    
    const Collection_Ids = [445, 548];
   
	let hooks = [],
        insidemap = false,
        bossInfo = undefined,        
        timers = {},
        bossLoc = undefined,
        flowerId = 999999999,
        playerDebuffs = [],
        bossHpWarningsNotified = [],
        // Lakan
        shieldWarned = false,
		timerNextMechanic = undefined, 
		lastNextAction = undefined,
		lastInversionTime = undefined,
		isReversed = false, // below 50% hp
		inSoulWorld = false    
            
    mod.command.add('vs', (arg, arg2) => {
        if (arg) arg = arg.toLowerCase();
        if (arg2) arg2 = arg2.toLowerCase();
        
        if (arg === undefined) {
            mod.settings.enabled = !mod.settings.enabled;
            mod.command.message(enabled ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00'));
            (mod.settings.enabled) ? load() : unload();
        }
        else if(arg === "off")
        {
            mod.settings.enabled = false;
            mod.command.message(mod.settings.enabled ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00'));
            unload();
        }
        else if(arg === "on")
        {
            mod.settings.enabled = true;
            mod.command.message(mod.settings.enabled ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00'));
            load();
        }
        else if(["item", "items", "flowers"].includes(arg))
        {
            if (arg2 === "off") {
                mod.settings.showItems = false;
            } else if (arg2 === "on") {
                mod.settings.showItems = true;
            } else {
                mod.settings.showItems = !mod.settings.showItems;
            }
            mod.command.message('Show Items: ' + (mod.settings.showItems ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00')));
        }
        else if(["notice", "notices"].includes(arg))
        {
            if (arg2 === "off") {
                mod.settings.sendNotices = false;
            } else if (arg2 === "on") {
                mod.settings.sendNotices = true;
            } else {
                mod.settings.sendNotices = !mod.settings.sendNotices;
            }
            mod.command.message('Use Notices: ' + (mod.settings.sendNotices ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00')));
        }
        else if(["lakan"].includes(arg))
        {
            if (arg2 === "off") {
                mod.settings.showOnlyLakanMech = false;
            } else if (arg2 === "on") {
                mod.settings.showOnlyLakanMech = true;
            } else {
                mod.settings.showOnlyLakanMech = !mod.settings.showOnlyLakanMech;
            }
            mod.command.message('Show Only Lakan Mech: ' + (mod.settings.showOnlyLakanMech ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00')));
        }        
    });
    
    mod.game.me.on('change_zone', (zone, quick) => { 
        if (mapIDs.includes(zone)) {
            if (!insidemap) {
                mod.command.message('Welcome to Velik\'s Sanctuary '.clr('56B4E9') + (mapIDs[0] === zone ? '[NM]'.clr('E69F00') : mapIDs[1] === zone ? '[HM]'.clr('00FFFF') : ''));
            }
            insidemap = true;
            load();
        } else {
            insidemap = false;
            unload();
        }
    })
    
	function sendMessage(msg) {
		if(mod.settings.sendNotices) {
			mod.send('S_CHAT', 2, {
                channel: 21, //21 = p-notice, 1 = party
                authorName: 'DG-Guide',
                message: msg
			});
		} else {
			mod.command.message(msg);
		}
	}
    
    function bossHealth() {
        return Number(bossInfo.curHp) / Number(bossInfo.maxHp);
    }
	
	function startTimer(message, delay, id = 'default') {
        if (timers[id]) clearTimeout(timers[id]);
        timers[id] = setTimeout(() => {
			sendMessage(message);
			timers[id] = null;
		}, delay);	
	}

	function SpawnFlower(position, despawnDelay, collectionId){
        if (!mod.settings.showItems) return;
        
		mod.send('S_SPAWN_COLLECTION', 4, {
			gameId: flowerId,
			id: collectionId,
			amount: 1,
            loc: {x: position.x, y: position.y, z: bossLoc.z},
			w: 0,
			extractor: false,
            extractorDisabled: false,
            extractorDisabledTime: 0
		});
		setTimeout(DespawnFlower, despawnDelay, flowerId)
		flowerId--;
	}
	
	function DespawnFlower(id){
        mod.send('S_DESPAWN_COLLECTION', 2, {
            gameId: id,
            collected: false
        });
	}
    
	function SpawnLoc(degrees, radius) {
        let rads = (degrees * Math.PI/180);
        let finalrad = bossLoc.w - rads;
        
        let spawnx = bossLoc.x + radius * Math.cos(finalrad);
        let spawny = bossLoc.y + radius * Math.sin(finalrad);
        return {x:spawnx,y:spawny};
	}
    
    // Darkan
    function DarkanInOutRange() {
        for (let degree = 0; degree < 360; degree += 360 / 20) {
            SpawnFlower(SpawnLoc(degree,300), 6000, Collection_Ids[0]);
        }
    }
    
    // Lakan safespots
    function BegoneRange() {
        for (let degree = 0; degree < 360; degree += 360 / 20) {
            SpawnFlower(SpawnLoc(degree,250), 6000, Collection_Ids[0]);
        }
    }
        
    function LaserStarNormal() {
        for (let i = 0; i < LakanLaserSafespots.length; i++) {
            SpawnFlower(SpawnLoc(LakanLaserSafespots[i], 450), 5000,  Collection_Ids[1])
        }
        for (let i = 0; i < LakanLaserNormalDangerOne.length; i++) {
            for (let radius = 100; radius < 1000; radius += 50) {
                SpawnFlower(SpawnLoc(LakanLaserNormalDangerOne[i], radius), 2500, Collection_Ids[0]);
            }
        }
    }
    function LaserStarInverted() {
        for (let i = 0; i < LakanLaserSafespots.length; i++) {
            SpawnFlower(SpawnLoc(LakanLaserSafespots[i], 450), 5000,  Collection_Ids[1])
        }
        for (let i = 0; i < LakanLaserInvertedDangerOne.length; i++) {
            for (let radius = 100; radius < 1000; radius += 50) {
                SpawnFlower(SpawnLoc(LakanLaserInvertedDangerOne[i], radius), 2500, Collection_Ids[0]);
            }
        }
    }
    
    
    // Hooks
    function load() {
        if(!hooks.length) {

            hook('S_BOSS_GAGE_INFO', 3, event => {
                bossInfo = event;
                
                let bossHp = bossHealth();      
                                
                // Reset Lakan
                if (bossInfo.templateId === 3000) {
                    if (bossHp <= 0 || bossHp >= 1) {
                        lastNextAction = undefined;
                        isReversed = false;
                        inSoulWorld = false;
                        shieldWarned = false;
                        lastInversionTime = undefined;
                    } else {
                        if (!lastInversionTime) lastInversionTime = Date.now();
                    }
                    
                    if (Date.now() > (lastInversionTime + ShieldWarningTime) && !shieldWarned) {
                        let hint = (!inSoulWorld ? BossActions[3000][1401].msg : BossActions[3000][1402].msg);
                        sendMessage(ShieldWarningMessage + ' -> ' + hint);
                        shieldWarned = true;
                    }
                }
                
                // Reset all bosses
                if (bossHp <= 0) {
                    bossInfo = undefined;
                    //if (timer) clearTimeout(timer);
                    for (let timer in timers) {
                        if (timer) clearTimeout(timer);
                    }
                    timers = {};
                    playerDebuffs = [];
                    flowerId = 999999999;
                    bossHpWarningsNotified = [];
                }
            });
            
            hook('S_ACTION_STAGE', 8, (event) => {         
                if (!bossInfo) return;
                if (event.stage != 0) return;
                if (mod.settings.showOnlyLakanMech && ![1404, 3103, 1301, 1405, 3105, 1302, 1304, 1401, 1402].includes(event.skill.id)) return;

                if (!BossActions[event.templateId]) return;
                
                let bossAction = BossActions[event.templateId][event.skill.id];
                if (!bossAction) bossAction = BossActions[event.templateId][event.skill.id - 1000]; // check if skill is enraged
                
                if (bossAction) 
                {
                    bossLoc = event.loc;
                    bossLoc.w = event.w;
                    
                    if (bossAction.func) bossAction.func();
                    if (bossAction.msg) sendMessage(bossAction.msg);
                    
                    // Lakan stuff
                    if (bossInfo.templateId === 3000) {
                        let nextMessage;
                        if (event.skill.id == 1401 || event.skill.id == 2401) {                              // normal to inverse aka soul world
                            inSoulWorld = true;
                            if (lastNextAction) {
                                nextMessage = BossActions[3000][InversedAction[lastNextAction]].msg;
                                startTimer('Next: ' + nextMessage, LakanNextMessageDelay, 'Lakan');
                            }
                            lastInversionTime = Date.now();
                            shieldWarned = false;
                        } else if (event.skill.id == 1402 || event.skill.id == 2402) {                       // inverse to normal
                            inSoulWorld = false;
                            if (lastNextAction) {
                                nextMessage = BossActions[3000][InversedAction[lastNextAction]].msg;
                                startTimer('Next: ' + nextMessage, LakanNextMessageDelay, 'Lakan');
                            }
                            lastInversionTime = Date.now();
                            shieldWarned = false;
                        } else if (!isReversed && bossAction.next) {                                         // normal "next"
                            nextMessage = BossActions[3000][bossAction.next].msg;
                            startTimer('Next: ' + nextMessage, LakanNextMessageDelay, 'Lakan');
                            lastNextAction = bossAction.next;
                        } else if (isReversed && bossAction.prev) {                                          // reversed "next"
                            nextMessage = BossActions[3000][bossAction.prev].msg;
                            startTimer('Next: ' + nextMessage, LakanNextMessageDelay, 'Lakan');
                            lastNextAction = bossAction.prev;
                        }
                    }
                    
                }
            });


            hook('S_DUNGEON_EVENT_MESSAGE', 2, (event) => {	
                if (!bossInfo) return;
                
                let msgId = parseInt(event.message.replace('@dungeon:', '')) % 10000;

                if (BossMessages[msgId]) {
                    for (let timer in timers) {
                        if (timer) clearTimeout(timer);
                    }
                    
                    if (bossInfo.templateId === 3000) {
                        let lastNextActionBackup = lastNextAction;
                        lastNextAction = undefined;
                        isReversed = (bossHealth() < 0.5) ? true : false;
                        if (inSoulWorld) {
                            sendMessage('Next: ' + BossActions[3000][InversedAction[BossMessages[msgId]]].msg);
                            lastNextAction = InversedAction[BossMessages[msgId]].prev;
                        } else {
                            sendMessage('Next: ' + BossActions[3000][BossMessages[msgId]].msg);
                            lastNextAction = [BossMessages[msgId]].prev;
                        }
                    }
                }
            });
            
            hook('S_QUEST_BALLOON', 1, (event) => {	
                let msgId = parseInt(event.message.replace('@dungeon:', '')) % 10000;
                if (BossMessages[msgId]) {
                    if (BossMessages[msgId].msg) sendMessage(BossMessages[msgId].msg);
                }
            });
            
        }
    }
	
	function unload() {
		if(hooks.length) {
			for(let h of hooks) mod.unhook(h)

			hooks = []
		}
	}

	function hook() {
		hooks.push(mod.hook(...arguments))
	}

}
