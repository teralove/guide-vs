String.prototype.clr = function (hexColor) { return `<font color='#${hexColor}'>${this}</font>` };

module.exports = function VSGuide(mod) {	
	const config = require('./config.json');
    const mapIDs = [9781, 9981]; 
    //const {BossActions, BossMessages, InversedAction} = require('./skills');
    
    // BossAction[TempalateId][Skill.id]
    const BossActions = {
        // Darkan
        1000: {
            //1111: {msg: 'test'},
        },     
        // Dakuryon
        2000: {
            //1111: {msg: 'test'},
        },                   
        // Lakan
        3000: {
            //1101: {msg: 'Auto'},
            1116: {msg: 'Wave'}, //1116, 1132
            
            1136: {msg: 'Claw'},
            1138: {func: BegoneRange}, // Begone
            1148: {msg: 'Barrage'},
            //1149: {msg: 'Barrage'},
            1152: {msg: 'Stun + Back'},
            //1154: {msg: 'Out + In', func: BegoneOutIn},
            //1155: {msg: 'In + Out', func: BegoneInOut},
            1144: {msg: 'Get Out', func: BegoneRange},
            1145: {msg: 'Get In', func: BegoneRange}, // Red
            
            1240: {msg: 'Donuts'},
            1401: {msg: 'Plague/Regress'},     // Shield normal to inverse
            1402: {msg: 'Sleep'},              // Shield inverse to normal
            1701: {msg: "Back + Stab"},
            
            // Normal
            1404: {msg: '(Marks) Debuff (closest)',    next: 3103,    prev: 1301},
            3103: {msg: '(Circles) Spread',            next: 1301,    prev: 1404},
            1301: {msg: '(Bombs) Gather + cleanse',    next: 1404,    prev: 3103},
            // Inversed
            1405: {msg: '(Marks) Debuff (farthest)',   next: 3104,    prev: 1302},
            3104: {msg: '(Circles) Gather',            next: 1302,    prev: 1405},
            1302: {msg: '(Bombs) Gather + no cleanse', next: 1405,    prev: 3104},
            
            // Normal
            //1901: {msg: '(Marks) Debuff (closest)',    next: 1905,    prev: 1903,   func: LaserStarNormal},
            //1905: {msg: '(Circles) Spread',            next: 1903,    prev: 1901,   func: LaserStarNormal},
            //1903: {msg: '(Bombs) Gather + cleanse',    next: 1901,    prev: 1905,   func: LaserStarNormal},
            // Inversed
           // 1902: {msg: '(Marks) Debuff (farthest)',   next: 1906,    prev: 1904,   func: LaserStarInverted},
           // 1906: {msg: '(Circles) Gather',            next: 1904,    prev: 1902,   func: LaserStarInverted},
            //1904: {msg: '(Bombs) Gather + no cleanse', next: 1902,    prev: 1906,   func: LaserStarInverted},
        },
    }

    //MessageId: BossAction
    const BossMessages = {
        9781043: 1404,   // Lakan has noticed you.
        9781044: 3103,   // Lakan is trying to take you on one at a time.	
        9781045: 1301,   // Lakan intends to kill all of you at once.
    }
    
    // Lakan stuff  
    const InversedAction = {
        1404: 1405,
        3103: 3104,
        1301: 1302,
        1405: 1404,
        3104: 3103,
        1302: 1301
    }   
    
    
    const LakanNextMessageDelay = 5000;
    const ShieldWarningTime = 80000; //ms
    const ShieldWarningMessage = 'Ring soon';
    const LakanLaserSafespots = [18, 54, 90, 126, 162, 198, 234, 270, 306, 342];
    const LakanLaserNormalDangerOne = [0, 72, 144, 216, 288];
    const LakanLaserInvertedDangerOne = [36, 108, 180, 252, 324];
    
    const Collection_Ids = [445, 548];
   
	let hooks = [],
        enabled = config.enabled,
        insidemap = false,
//        streamMode = config.streamMode,
        showItems = config.showItems,
        sendNotices = config.sendNotices,
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
            enabled = !enabled;
            mod.command.message(enabled ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00'));
        }
        else if(arg === "off")
        {
            enabled = false;
            mod.command.message(enabled ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00'));
        }
        else if(arg === "on")
        {
            enabled = true;
            mod.command.message(enabled ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00'));
        }
        else if(["item", "items", "flowers"].includes(arg))
        {
            if (arg2 === "off") {
                showItems = false;
            } else if (arg2 === "on") {
                showItems = true;
            } else {
                showItems = !showItems;
            }
            mod.command.message('Show Items: ' + (showItems ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00')));
        }
        else if(["notice", "notices"].includes(arg))
        {
            if (arg2 === "off") {
                sendNotices = false;
            } else if (arg2 === "on") {
                sendNotices = true;
            } else {
                sendNotices = !sendNotices;
            }
            mod.command.message('Use Notices: ' + (sendNotices ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00')));
        }
        else if(["lakan"].includes(arg))
        {
            if (arg2 === "off") {
                showOnlyLakanMech = false;
            } else if (arg2 === "on") {
                showOnlyLakanMech = true;
            } else {
                showOnlyLakanMech = !showOnlyLakanMech;
            }
            mod.command.message('Show Only Lakan Mech: ' + (showOnlyLakanMech ? 'Enabled'.clr('56B4E9') : 'Disabled'.clr('E69F00')));
        }        
    });
    
    mod.game.me.on('change_zone', (zone, quick) => { 
    
        console.log('zone: ' + zone);
    
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
        if (!enabled) return;
        
		if(!sendNotices) {
			mod.command.message(msg);
		} else {
			mod.send('S_CHAT', 1, {
                channel: 21, //21 = p-notice, 1 = party
                authorName: 'DG-Guide',
                message: msg
			});
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
        if (!showItems) return;
        
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

                if (event.templateId == 3000) mod.command.message('skill:   ' + event.skill.id);
                
                if (!BossActions[event.templateId]) return;
                
                let bossAction = BossActions[event.templateId][event.skill.id];
                if (!bossAction) bossAction = BossActions[event.templateId][event.skill.id - 1000]; // check if skill is enraged
                
                if (bossAction) 
                {
					//if (!BossActions[event.templateId].enabled) return;
					
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
                
                let msgId = parseInt(event.message.replace('@dungeon:', ''));
                if (bossInfo.templateId === 3000) {
                    mod.command.message('msgID: ' + msgId);
                }
                
                if (BossMessages[msgId]) {
                    for (let timer in timers) {
                        if (timer) clearTimeout(timer);
                    }
                    
                    if (bossInfo.templateId === 3000) {
                        lastNextAction = undefined;
                        isReversed = (bossHealth() < 0.5) ? true : false;
                        if (inSoulWorld) {
                            sendMessage('Next: ' + BossActions[3000][InversedAction[BossMessages[msgId]]].msg);
                        } else {
                            sendMessage('Next: ' + BossActions[3000][BossMessages[msgId]].msg);
                        }
                    }
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
