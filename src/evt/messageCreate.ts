import { Context } from '..';
import config from '../config';
import { inspect } from 'util';

import tags from '../tags';

const isNewAccount = (createdAt: number) => {
	const now = Math.floor((new Date() as unknown as number) / 1000);
	if (createdAt > (now - config.newAccountDuration))
		return true;
}

const token: string = process.env.token!;

let allowChatAccess: boolean = true;

export default async (evt: any, ctx: Context) => {
	if (!evt.content) return;
	if (evt.author.bot) return;
	
	const content: string = evt.content.toLowerCase();

	if (evt.author.id != "883545422860283964") return;

	if (content == "?ping")
	return await ctx.rest.createMessage(evt.channel_id, "meow!");
	
	if (evt.guild_id != config.guild_id) return;

	if (["?tags", "?tag list", "?taglist"].includes(content))
		return await ctx.rest.createMessage(evt.channel_id, {
			content: `available tags: ${Object.keys(tags).join(', ')}`,
			allowedMentions: { parse: [] }
		});

	let tag = tags[content.substring(1) as string];
	if (content && content[0] == "?" && tag && evt.guild_id == config.guild_id)
		return await ctx.rest.createMessage(evt.channel_id, {
				content: (typeof tag === 'string' ? tag : undefined),
				embeds: (typeof tag === 'string' ? undefined : [ tag ]),
				allowedMentions: { parse: [], repliedUser: true },
				messageReference: evt.message_reference ? {
					channelId: evt.channel_id,
					messageId: evt.message_reference.message_id,
				} : undefined,
			});

	if (content == "?rank chat access") {
		if (evt.guild_id != config.guild_id)
			return;

		if (evt.member.roles.includes(config.restrict_role_id)) {
			console.log(evt.author.id, evt.author.name, "lol");
			await ctx.rest.createReaction(evt.channel_id, evt.id, "\u274c");
			return;
		}
		if (isNewAccount(evt.member.createdAtUnix)) {
			await ctx.rest.createMessage(evt.channel_id, {
				content: `\u274c Account too new. Try again in a bit!`,
				allowedMentions: { parse: [] },
				messageReference: {
					channelId: evt.channel_id,
					messageId: evt.id,
				},
			});
			return;
		}

		if (evt.member.roles.includes(config.chat_role_id)) {
			let roles = evt.member.roles.filter((role: string) => role != config.chat_role_id);
			await ctx.rest.editGuildMember(evt.guild_id, evt.author.id, { roles });
			await ctx.rest.createMessage(evt.channel_id, {
				content: `Removed <@&${config.chat_role_id}> from <@!${evt.author.id}>.`,
				allowedMentions: { parse: [] },
				messageReference: {
					channelId: evt.channel_id,
					messageId: evt.id,
				},
			});
		} else {
			if (!allowChatAccess) {
				await ctx.rest.createMessage(evt.channel_id, {
					content: `\u274c This command is currently disabled, please try again later.`,
					allowedMentions: { parse: [] },
					messageReference: {
						channelId: evt.channel_id,
						messageId: evt.id,
					},
				});
				return;
			}

			evt.member.roles.push(config.chat_role_id);
			await ctx.rest.editGuildMember(evt.guild_id, evt.author.id, { roles: evt.member.roles });
			await ctx.rest.createMessage(evt.channel_id, {
				content: `Added <@&${config.chat_role_id}> to <@!${evt.author.id}>.`,
				allowedMentions: { parse: [] },
				messageReference: {
					channelId: evt.channel_id,
					messageId: evt.id,
				},
			})
		}
	}

	if (content?.startsWith(".eval ") && evt.member.roles.includes(config.admin_role_id)) {
		let res;
		try {
			res = await eval(`(async () => {${evt.content.slice(5)}})()`);
		} catch(e) {
			res = (e as any).toString();
		}

		console.log("EVAL:", res);
		let len = `${res}`.length;
		res = inspect(res).split(token).join("[[ TOKEN ]]").slice(0, 500);
		if (len > 500) res += "... (check console)";

		await ctx.rest.createMessage(evt.channel_id, res);
	}

	if (content?.startsWith("+s") && evt.member.roles.includes(config.infra_role_id)) {
		if (content == "+s h" || content == "+s help") {
			await ctx.rest.createMessage(evt.channel_id, "server-checks chatops\n\n`+s`: list silences\n`+s +<silence>`: create silence\n`+s -<silence>`: delete silence"
				+ "\n`+s override`: override @infra pings to your account (for testing and such)\n`+s clearoverride`: clear ping override");
		} else if (content.length == 2) {
			let res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/silences`,
				{ headers: { authorization: `Bearer ${process.env.cf_token}` } })
				.then((x: any) => x.json());
			console.log(res);
			let silences = res.map((x: any) => `- \`${x.check ?? (x.checkPrefix+"*")}@${x.node}\``).join("\n");
			if (silences == "") silences = "no silences set";
			await ctx.rest.createMessage(evt.channel_id, silences);
		} else if (content[3] == "+") {
			// add silence
			let newsilence: any = content.slice(4).split("@");
			if (newsilence.length != 2) {
				await ctx.rest.createMessage(evt.channel_id, "format: `check@host`, optionally accepting a wildcard for hostname (`somecheck@*`) and/or at end of check name (someprefix*@somehost)")
				return
			}
			// parse text
			newsilence = [newsilence].map(x => ({ check: x[0], checkPrefix: null, node: x[1] }))
				.map(x => {
					if (x.check.endsWith("*")) {
						x.checkPrefix = x.check.slice(0, -1);
						x.check = null;
					}
					return x;
				})[0];
			console.log(newsilence);

			let curSilences = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/silences`,
				{ headers: { authorization: `Bearer ${process.env.cf_token}` } })
				.then((x: any) => x.json());

			if (!!curSilences.find((x: any) => x.check == newsilence.check && x.checkPrefix == newsilence.checkPrefix && x.node == newsilence.node)) {
				await ctx.rest.createMessage(evt.channel_id, "check already exists");
				return;
			}

			curSilences.push(newsilence);

			let res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/silences`,
				{
						method: "PUT",
						headers: { authorization: `Bearer ${process.env.cf_token}` },
						body: JSON.stringify(curSilences),
				})
				.then((x: any) => x.json());
			if (res.success) {
				await ctx.rest.createMessage(evt.channel_id, "ok");
			} else {
				await ctx.rest.createMessage(evt.channel_id, `not ok: ${JSON.stringify(res)}`);
			}
		} else if (content[3] == "-") {
			// remove silence
			let newsilence: any = content.slice(4).split("@");
			if (newsilence.length != 2) {
				await ctx.rest.createMessage(evt.channel_id, "format: `check@host`, optionally accepting a wildcard for hostname (`somecheck@*`) and/or at end of check name (someprefix*@somehost)")
				return
			}
			// parse text
			newsilence = [newsilence].map(x => ({ check: x[0], checkPrefix: null, node: x[1] }))
				.map(x => {
					if (x.check.endsWith("*")) {
						x.checkPrefix = x.check.slice(0, -1);
						x.check = null;
					}
					return x;
				})[0];
			console.log(newsilence);

			let curSilences = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/silences`,
				{ headers: { authorization: `Bearer ${process.env.cf_token}` } })
				.then((x: any) => x.json());
			console.log("del: get", curSilences);

			let idx = curSilences.find((x: any) => x.check == newsilence.check && x.checkPrefix == newsilence.checkPrefix && x.node == newsilence.node);

			if (idx == null) {
				await ctx.rest.createMessage(evt.channel_id, "check doesn't exist");
				return;
			}

			curSilences.splice(idx, 1);
			console.log("del: send", curSilences);

			let res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/silences`,
				{
						method: "PUT",
						headers: { authorization: `Bearer ${process.env.cf_token}` },
						body: JSON.stringify(curSilences),
				})
				.then((x: any) => x.json());
			if (res.success) {
				await ctx.rest.createMessage(evt.channel_id, "ok");
			} else {
				await ctx.rest.createMessage(evt.channel_id, `not ok: ${JSON.stringify(res)}`);
			}
		} else if (content == "+s clear") {
			let res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/silences`,
				{
						method: "PUT",
						headers: { authorization: `Bearer ${process.env.cf_token}` },
						body: JSON.stringify([]),
				})
				.then((x: any) => x.json());
			if (res.success) {
				await ctx.rest.createMessage(evt.channel_id, "ok");
			} else {
				await ctx.rest.createMessage(evt.channel_id, `not ok: ${JSON.stringify(res)}`);
			}
		} else if (content == "+s override") {
			let res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/notif`,
				{
						method: "PUT",
						headers: { authorization: `Bearer ${process.env.cf_token}` },
						body: `<@${evt.author.id}>`,
				})
				.then((x: any) => x.json());
			if (res.success) {
				await ctx.rest.createMessage(evt.channel_id, "ok");
			} else {
				await ctx.rest.createMessage(evt.channel_id, `not ok: ${JSON.stringify(res)}`);
			}
		} else if (content == "+s clearoverride") {
			let res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${process.env.cf_account}/storage/kv/namespaces/4fd4893d94354dac96da55a68c5df4fc/values/notif`,
				{
						method: "PUT",
						headers: { authorization: `Bearer ${process.env.cf_token}` },
						body: "",
				})
				.then((x: any) => x.json());
			if (res.success) {
				await ctx.rest.createMessage(evt.channel_id, "ok");
			} else {
				await ctx.rest.createMessage(evt.channel_id, `not ok: ${JSON.stringify(res)}`);
			}
		}
	}
}
