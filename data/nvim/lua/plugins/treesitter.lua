---@diagnostic disable: undefined-global

return {
	"nvim-treesitter/nvim-treesitter",
	lazy = false,
	branch = "main",
	build = ":TSUpdate",
	config = function()
		require("nvim-treesitter").setup({})
		require("nvim-treesitter").install({
			"bash",
			"c",
			"go",
			"gomod",
			"gosum",
			"html",
			"javascript",
			"lua",
			"luadoc",
			"markdown",
			"rust",
			"tsx",
			"typescript",
		})
		vim.api.nvim_create_autocmd("FileType", {
			group = vim.api.nvim_create_augroup("kickstart-treesitter-start", { clear = true }),
			pattern = {
				"bash",
				"c",
				"go",
				"gomod",
				"gosum",
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
}
