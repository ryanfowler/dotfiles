---@diagnostic disable: undefined-global

local api = vim.api
local opt = vim.opt

-- Basic UI/UX.
opt.mouse = "a"
opt.number = true
opt.relativenumber = false
opt.showmode = false

-- Sync clipboard between OS and neovim.
vim.schedule(function()
	opt.clipboard = "unnamedplus"
end)

-- Search settings.
opt.ignorecase = true
opt.smartcase = true

-- Splits/layout.
opt.colorcolumn = "80"
opt.cursorline = true
opt.scrolloff = 10
opt.signcolumn = "yes"
opt.splitbelow = true
opt.splitright = true

-- Timings.
opt.timeoutlen = 250
opt.updatetime = 250

-- Whitespace.
opt.list = true
opt.listchars = { tab = "» ", lead = "·", trail = "·", nbsp = "␣" }

-- Persistence.
opt.breakindent = true
opt.undofile = true

-- Preview substitutions live.
opt.inccommand = "split"

-- Disable line wrap.
vim.wo.wrap = false

-- Highlight text when yanking.
api.nvim_create_autocmd("TextYankPost", {
	desc = "Highlight when yanking (copying) text",
	group = vim.api.nvim_create_augroup("kickstart-highlight-yank", { clear = true }),
	callback = function()
		vim.highlight.on_yank()
	end,
})

-- Bring up the fuzzy file finder on startup.
vim.g.loaded_netrwPlugin = 0
api.nvim_create_autocmd("VimEnter", {
	callback = function()
		if vim.fn.argv(0) == "" then
			require("telescope.builtin").find_files()
		end
	end,
})
