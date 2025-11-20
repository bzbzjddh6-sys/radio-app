// index.js
const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

// --------------------
// Música
// --------------------
let player = createAudioPlayer();
let queue = [];
let connection = null;
const DEFAULT_CHANNEL_NAME = "⌈→💬←⌉𝕮𝖆𝖓𝖆𝖑 𝟏";

async function joinDefaultChannel(guild, memberChannel=null) {
  let channel = memberChannel || guild.channels.cache.find(c => c.name === DEFAULT_CHANNEL_NAME && c.type === 2);
  if(!channel) return console.log(`❌ No se encontró el canal "${DEFAULT_CHANNEL_NAME}"`);
  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator
  });
  connection.subscribe(player);
  console.log(`✅ Bot unido al canal "${channel.name}"`);
}

async function playMusic() {
  if(queue.length === 0) return;
  const url = queue[0];
  try {
    // Stream con buffer grande para Replit
    const resource = createAudioResource(ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 27 }));
    player.play(resource);
    player.once(AudioPlayerStatus.Idle, () => {
      queue.shift();
      if(queue.length > 0) playMusic();
    });
  } catch(e) {
    console.log("❌ Error reproduciendo canción:", e);
    queue.shift();
    if(queue.length > 0) playMusic();
  }
}

// --------------------
// Comandos
// --------------------
const commandsData = [
  // Información
  new SlashCommandBuilder().setName('ping').setDescription('Responde Pong!'),
  new SlashCommandBuilder().setName('clima').setDescription('Muestra el clima de una ciudad').addStringOption(o => o.setName('ciudad').setDescription('Ciudad o isla').setRequired(true)),
  new SlashCommandBuilder().setName('noticias').setDescription('Muestra noticias recientes'),
  new SlashCommandBuilder().setName('cripto').setDescription('Precio de criptomonedas').addStringOption(o => o.setName('moneda').setDescription('Moneda').setRequired(true).addChoices(
    { name: 'BTC', value:'BTC' }, { name:'ETH', value:'ETH' }, { name:'DOGE', value:'DOGE' }, { name:'LTC', value:'LTC' }
  )),

  // Moderación
  new SlashCommandBuilder().setName('kick').setDescription('Expulsa un usuario').addUserOption(o => o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true)).addStringOption(o => o.setName('razon').setDescription('Razón')),
  new SlashCommandBuilder().setName('ban').setDescription('Banea un usuario').addUserOption(o => o.setName('usuario').setDescription('Usuario a banear').setRequired(true)).addStringOption(o => o.setName('razon').setDescription('Razón')),
  new SlashCommandBuilder().setName('mute').setDescription('Silencia un usuario').addUserOption(o => o.setName('usuario').setDescription('Usuario a silenciar').setRequired(true)).addStringOption(o => o.setName('tiempo').setDescription('Tiempo en minutos (vacío = permanente)')),
  new SlashCommandBuilder().setName('clear').setDescription('Borra mensajes').addStringOption(o => o.setName('cantidad').setDescription('Cantidad de mensajes').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('Advertencia a un usuario').addUserOption(o => o.setName('usuario').setDescription('Usuario a advertir').setRequired(true)).addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(true)),

  // Estadísticas
  new SlashCommandBuilder().setName('miembros').setDescription('Número total de miembros'),
  new SlashCommandBuilder().setName('roles').setDescription('Lista de roles con cantidad de miembros'),
  new SlashCommandBuilder().setName('canales').setDescription('Lista de canales del servidor'),

  // Utilidad
  new SlashCommandBuilder().setName('dado').setDescription('Tira un dado del 1 al 10'),
  new SlashCommandBuilder().setName('recordatorio').setDescription('Te recuerda algo después de un tiempo').addStringOption(o => o.setName('tiempo').setDescription('Tiempo en minutos').setRequired(true)).addStringOption(o => o.setName('mensaje').setDescription('Mensaje a recordar').setRequired(true)),
  new SlashCommandBuilder().setName('say').setDescription('Hace que el bot diga algo').addStringOption(o => o.setName('mensaje').setDescription('Mensaje a decir').setRequired(true)),

  // Música
  new SlashCommandBuilder().setName('play').setDescription('Reproduce un link de YouTube').addStringOption(o => o.setName('link').setDescription('Link de YouTube').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Salta la canción actual'),
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la música'),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa la música'),
  new SlashCommandBuilder().setName('resume').setDescription('Reanuda la música')
].map(cmd => cmd.toJSON());

// --------------------
// Registrar comandos
// --------------------
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try { await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commandsData }); console.log('¡Comandos registrados!'); }
  catch (error) { console.error(error); }
})();

// --------------------
// Handlers
// --------------------
const commandHandlers = {
  ping: async i => i.reply('Pong!'),

  clima: async i => {
    const ciudad = i.options.getString('ciudad');
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ciudad)}, España&format=json&limit=1`);
      const geoData = await geoRes.json();
      if(!geoData || geoData.length===0) return i.reply('❌ Ciudad no encontrada.');
      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      const climaRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const climaData = await climaRes.json();
      const w = climaData.current_weather;
      const embed = new EmbedBuilder()
        .setTitle(`🌤 Clima en ${ciudad}`)
        .setDescription(`🌡 Temperatura: ${w.temperature}°C\n💨 Viento: ${w.windspeed} km/h\n🌬 Dirección: ${w.winddirection}°`)
        .setColor('Blue')
        .setFooter({ text: 'ByAmPerio' });
      i.reply({ embeds: [embed] });
    } catch(e){ i.reply('❌ Error obteniendo clima.'); }
  },

  noticias: async i => {
    try {
      const rssRes = await fetch(`https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada`);
      const rssText = await rssRes.text();
      const items = [...rssText.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g)];
      const noticias = items.slice(0,5).map(n=>`• [${n[1]}](${n[2]})`);
      const embed = new EmbedBuilder()
        .setTitle(`📰 Noticias recientes`)
        .setDescription(noticias.join('\n'))
        .setColor('Blue')
        .setFooter({ text: 'ByAmPerio' });
      i.reply({ embeds: [embed] });
    } catch(e){ i.reply('❌ Error obteniendo noticias.'); }
  },

  cripto: async i => {
    const cryptoMap = { BTC:'bitcoin', ETH:'ethereum', DOGE:'dogecoin', LTC:'litecoin' };
    const moneda = i.options.getString('moneda').toUpperCase();
    const id = cryptoMap[moneda] || moneda.toLowerCase();
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      const data = await res.json();
      if(!data[id]) return i.reply('❌ Moneda no encontrada.');
      const embed = new EmbedBuilder()
        .setTitle(`💰 Precio de ${moneda}`)
        .setDescription(`Actualmente: $${data[id].usd}`)
        .setColor('Blue')
        .setFooter({ text: 'ByAmPerio' });
      i.reply({ embeds: [embed] });
    } catch(e){ i.reply('❌ Error obteniendo precio.'); }
  },

  // Moderación
  kick: async i => { const user = i.options.getUser('usuario'); const reason = i.options.getString('razon') || 'No especificada'; if(!i.member.permissions.has('KickMembers')) return i.reply('❌ No tienes permiso.'); try{ const member = await i.guild.members.fetch(user.id); await member.kick(reason); i.reply(`✅ ${user.tag} expulsado.\nRazón: ${reason}`); }catch(e){ i.reply('❌ No se pudo expulsar.'); } },
  ban: async i => { const user = i.options.getUser('usuario'); const reason = i.options.getString('razon') || 'No especificada'; if(!i.member.permissions.has('BanMembers')) return i.reply('❌ No tienes permiso.'); try{ const member = await i.guild.members.fetch(user.id); await member.ban({reason}); i.reply(`✅ ${user.tag} baneado.\nRazón: ${reason}`); }catch(e){ i.reply('❌ No se pudo banear.'); } },
  mute: async i => { const user = i.options.getUser('usuario'); const tiempo = i.options.getString('tiempo'); if(!i.member.permissions.has('ModerateMembers')) return i.reply('❌ No tienes permiso.'); try{ const member = await i.guild.members.fetch(user.id); const muteRole = i.guild.roles.cache.find(r => r.name==='Muted') || await i.guild.roles.create({name:'Muted', permissions:[]}); await member.roles.add(muteRole); if(tiempo) setTimeout(()=>member.roles.remove(muteRole), parseInt(tiempo)*60000); i.reply(`✅ ${user.tag} silenciado ${tiempo?`por ${tiempo} minutos`:'permanentemente'}.`); }catch(e){ i.reply('❌ No se pudo silenciar.'); } },
  clear: async i => { const cantidad = parseInt(i.options.getString('cantidad')); if(!i.member.permissions.has('ManageMessages')) return i.reply('❌ No tienes permiso.'); try{ const messages = await i.channel.messages.fetch({limit:cantidad}); await i.channel.bulkDelete(messages); i.reply(`✅ ${cantidad} mensajes eliminados.`); }catch(e){ i.reply('❌ No se pudo eliminar.'); } },
  warn: async i => { const user = i.options.getUser('usuario'); const reason = i.options.getString('razon'); i.reply(`⚠️ ${user.tag} advertido.\nRazón: ${reason}`); },

  // Estadísticas
  miembros: async i => i.reply(`👥 Total de miembros: ${i.guild.memberCount}`),
  roles: async i => i.reply(`📋 Roles:\n${i.guild.roles.cache.sort((a,b)=>b.position-a.position).map(r=>`${r.name}: ${r.members.size}`).join('\n')}`),
  canales: async i => i.reply(`📋 Canales:\n${i.guild.channels.cache.map(c=>`${c.name} (${c.type})`).join('\n')}`),

  // Utilidad
  dado: async i => i.reply(`🎲 Ha salido: ${Math.floor(Math.random()*10)+1}`),
  recordatorio: async i => { const tiempo = parseInt(i.options.getString('tiempo')); const mensaje = i.options.getString('mensaje'); i.reply(`⏰ Recordatorio establecido en ${tiempo} minuto(s).`); setTimeout(()=> i.user.send(`⏰ Recordatorio: ${mensaje}`), tiempo*60000); },
  say: async i => i.channel.send(i.options.getString('mensaje')),

  // Música
  play: async i => {
    await i.deferReply();
    const rawLink = i.options.getString('link');
    const match = rawLink.match(/v=([\w-]+)/);
    if(!match) return i.editReply("❌ Link inválido de YouTube.");
    const link = `https://www.youtube.com/watch?v=${match[1]}`;
    if(!connection) await joinDefaultChannel(i.guild, i.member.voice.channel);
    queue.push(link);
    i.editReply(`🎵 Agregado a la cola: ${link}`);
    if(player.state.status !== AudioPlayerStatus.Playing) playMusic();
  },
  skip: async i => { player.stop(); i.reply('⏭ Canción saltada.'); },
  stop: async i => { queue=[]; player.stop(); i.reply('⏹ Música detenida.'); },
  pause: async i => { player.pause(); i.reply('⏸ Música pausada.'); },
  resume: async i => { player.unpause(); i.reply('▶ Música reanudada.'); }
};

// --------------------
client.once(Events.ClientReady, ()=>console.log(`Conectado como ${client.user.tag} | ByAmPerio`));
client.on(Events.InteractionCreate, async i=>{
  if(!i.isChatInputCommand()) return;
  const handler = commandHandlers[i.commandName];
  if(handler) await handler(i);
});

client.login(process.env.TOKEN);


