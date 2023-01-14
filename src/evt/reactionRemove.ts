import { Context } from "..";

import roles from '../react_roles';

export default async (evt: any, ctx: Context) => {
    const rr = roles[evt.message_id as string];
    if (!rr) return;
    
    const role = rr[evt.emoji.name];
    if (!role) return console.log(`unknown role, mid: ${evt.message_id}, emoji: ${evt.emoji.name}`);

    const currentRoles = await ctx.db.get(evt.user_id);

    if (!currentRoles.includes(role)) return console.log(`user already does not havge role ${role}, skipping...`);
    else console.log(`remove role ${role} from user, current roles: ${currentRoles}`);

    let newRoles = currentRoles.filter((x: any) => x != role);
    await ctx.rest.editGuildMember(evt.guild_id, evt.user_id, { roles: newRoles });
}