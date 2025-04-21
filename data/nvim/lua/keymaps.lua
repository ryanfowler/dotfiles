---@diagnostic disable: undefined-global

local set = vim.keymap.set

-- Clear search highlights.
set("n", "<Esc>", "<cmd>nohlsearch<CR>")

-- Navigate to previous buffer.
set("n", "<BS>", "<C-^>", { desc = "Jump to last buffer" })

-- Make scrolling less disorienting.
set("n", "<C-u>", "<C-u>zz")
set("n", "<C-d>", "<C-d>zz")

-- Center the cursor after moving to top, middle, or bottom of screen.
set("n", "L", "Lzz")
set("n", "M", "Mzz")
set("n", "H", "Hzz")

-- Diagnostic keymaps.
set("n", "[d", vim.diagnostic.goto_prev, { desc = "Go to previous [D]iagnostic message" })
set("n", "]d", vim.diagnostic.goto_next, { desc = "Go to next [D]iagnostic message" })
set("n", "<leader>e", vim.diagnostic.open_float, { desc = "Show diagnostic [E]rror messages" })
set("n", "<leader>q", vim.diagnostic.setloclist, { desc = "Open diagnostic [Q]uickfix list" })

-- Keybinds to make split navigation easier.
set("n", "<C-h>", "<C-w><C-h>", { desc = "Move focus to the left window" })
set("n", "<C-l>", "<C-w><C-l>", { desc = "Move focus to the right window" })
set("n", "<C-j>", "<C-w><C-j>", { desc = "Move focus to the lower window" })
set("n", "<C-k>", "<C-w><C-k>", { desc = "Move focus to the upper window" })

-- Terminal escape.
set("t", "<Esc><Esc>", "<C-\\><C-n>", { desc = "Exit terminal mode" })
