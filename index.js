const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

// Música
let player = createAudioPlayer();
let queue = [];
let connection = null;
const DEFAULT_CHANNEL_NAME = "⌈→💬←⌉𝕮𝖆𝖓𝖆𝖑 𝟏";

player.on(AudioPlayerStatus.Playing, () => console.log('▶ Música sonando'));
player.on(AudioPlayerStatus.Idle, () => console.log('⏹ Música parada'));
player.on('error', error => console.log(`❌ Error player: ${error.message}`));

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
    const resource = createAudioResource(
      ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 27 })
    ).on('error', e => console.log('❌ Error de ytdl:', e));
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

// Comandos básicos
const commandsData = [
  new SlashCommandBuilder().setName('play').setDescription('Reproduce un link de YouTube').addStringOption(o => o.setName('link').setDescription('Link de YouTube').setRequired(true)),
  new SlashCommandBuilder().setName('skip').setDescription('Salta la canción actual'),
  new SlashCommandBuilder().setName('stop').setDescription('Detiene la música'),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa la música'),
  new SlashCommandBuilder().setName('resume').setDescription('Reanuda la música')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try { 
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commandsData }); 
    console.log('¡Comandos registrados!'); 
  } catch (error) { console.error(error); }
})();

const commandHandlers = {
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

client.once(Events.ClientReady, ()=>console.log(`Conectado como ${client.user.tag} | ByAmPerio`));
client.on(Events.InteractionCreate, async i => {
  if(!i.isChatInputCommand()) return;
  const handler = commandHandlers[i.commandName];
  if(handler) await handler(i);
});

client.login(process.env.TOKEN);


