---@diagnostic disable: undefined-global
--
-- neovim configuration

-- Set <space> as the leader key.
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- Load settings and plugins.
require("options")
require("keymaps")
require("plugins")
