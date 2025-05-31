import { Context } from "..";
import config from "../config";

export default async (evt: any, ctx: Context) => {
  if (evt.guild_id != config.guild_id) return;

  let roles = await ctx.db.get(evt.user.id);
  if (
    !roles.includes(config.restrict_role_id) &&
    evt.roles.includes(config.restrict_role_id)
  ) {
    let roles = evt.roles.filter((role: string) => role != config.chat_role_id);
    await ctx.rest.editGuildMember(evt.guild_id, evt.user.id, { roles });
  }

  await ctx.db.set(evt.user.id, evt.roles);
};
