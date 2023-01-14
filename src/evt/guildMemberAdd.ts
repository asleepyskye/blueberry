import { Context } from "..";
import config from "../config";

export default async (evt: any, ctx: Context) => {
    if (evt.guild_id != config.guild_id) return;
    let roles = await ctx.db.get(evt.user.id);
    if (roles.length > 0)
        await ctx.rest.editGuildMember(evt.guild_id, evt.user.id, { roles });
}
