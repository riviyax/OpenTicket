const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

const configPath = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Find a category's full config block (label, description, emoji, value,
 * categoryId, roleIds) by its `value`.
 */
function getCategoryConfig(config, categoryValue) {
  return config.panel?.categories?.find((c) => c.value === categoryValue) || null;
}

/**
 * Human-readable label for a category value, falling back to the raw value
 * if the category is no longer defined in config.json (e.g. it was removed).
 */
function getCategoryLabel(config, categoryValue) {
  const cat = getCategoryConfig(config, categoryValue);
  return cat?.label || categoryValue || 'General';
}

/**
 * Resolve which role IDs should have access to / be pinged for a ticket.
 *
 * Controlled by `config.perCategoryRoles`:
 *  - false (default): every ticket, regardless of category, uses the single
 *    global `supportRoleIds` list.
 *  - true: each category uses its own `roleIds` array (defined on the
 *    category itself in `panel.categories`). If a category doesn't define
 *    `roleIds` (or the array is empty), it falls back to `supportRoleIds`.
 */
function getRoleIdsForCategory(config, categoryValue) {
  if (config.perCategoryRoles) {
    const cat = getCategoryConfig(config, categoryValue);
    if (cat?.roleIds?.length) return cat.roleIds;
  }
  return config.supportRoleIds || [];
}

/** True if the member has the Administrator permission. */
function isAdmin(member) {
  return !!member?.permissions?.has?.(PermissionFlagsBits.Administrator);
}

/** True if the member holds at least one of the given role IDs. */
function isStaff(member, roleIds) {
  if (!member || !roleIds?.length) return false;
  return roleIds.some((id) => member.roles?.cache?.has(id));
}

/** True if the member is an admin OR holds one of the given staff role IDs. */
function isStaffOrAdmin(member, roleIds) {
  return isAdmin(member) || isStaff(member, roleIds);
}

module.exports = {
  loadConfig,
  getCategoryConfig,
  getCategoryLabel,
  getRoleIdsForCategory,
  isAdmin,
  isStaff,
  isStaffOrAdmin
};
