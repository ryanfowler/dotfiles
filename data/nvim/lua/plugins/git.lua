---@diagnostic disable: undefined-global

return {
	{
		"lewis6991/gitsigns.nvim",
		opts = {
			signs = {
				add = { text = "+" },
				change = { text = "~" },
				delete = { text = "_" },
				topdelete = { text = "‾" },
				changedelete = { text = "~" },
			},
		},
	},
	{
		"linrongbin16/gitlinker.nvim",
		cmd = "GitLink",
		keys = {
			{
				"<leader>gl",
				function()
					require("gitlinker").link({ action = require("gitlinker.actions").clipboard })
				end,
				mode = { "n", "x" },
				desc = "Yank [G]it [L]ink",
			},
			{
				"<leader>gL",
				function()
					require("gitlinker").link({ action = require("gitlinker.actions").system })
				end,
				mode = { "n", "x" },
				desc = "Open [G]it [L]ink",
			},
			{
				"<leader>gb",
				function()
					require("gitlinker").link({
						action = require("gitlinker.actions").clipboard,
						router_type = "blame",
					})
				end,
				mode = { "n", "x" },
				desc = "Yank [G]it [B]lame",
			},
			{
				"<leader>gB",
				function()
					require("gitlinker").link({
						action = require("gitlinker.actions").system,
						router_type = "blame",
					})
				end,
				mode = { "n", "x" },
				desc = "Open [G]it [B]lame",
			},
		},
		config = function()
			require("gitlinker").setup({
				router = {
					browse = {
						["^github%..*%.com"] = require("gitlinker.routers").github_browse,
					},
					blame = {
						["^github%..*%.com"] = require("gitlinker.routers").github_blame,
					},
				},
			})
		end,
	},
}
