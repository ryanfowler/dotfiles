---@diagnostic disable: undefined-global

return {
	"nvim-treesitter/nvim-treesitter",
	event = { "BufReadPost", "BufNewFile" },
	branch = "main",
	build = ":TSUpdate",
	init = function()
		vim.api.nvim_create_autocmd("FileType", {
			group = vim.api.nvim_create_augroup("kickstart-treesitter-start", { clear = true }),
			pattern = {
				"bash",
				"c",
				"go",
				"html",
				"javascript",
				"lua",
				"markdown",
				"rust",
				"typescript",
				"typescriptreact",
			},
			callback = function(ev)
				vim.treesitter.start(ev.buf)
			end,
		})
	end,
	opts = {
		ensure_installed = {
			"bash",
			"c",
			"go",
			"html",
			"javascript",
			"lua",
			"luadoc",
			"markdown",
			"rust",
			"tsx",
			"typescript",
		},
	},
}
