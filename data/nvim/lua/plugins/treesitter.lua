---@diagnostic disable: undefined-global

return {
	"nvim-treesitter/nvim-treesitter",
	branch = "main",
	build = ":TSUpdate",
	config = function()
		require("nvim-treesitter").setup({})
		require("nvim-treesitter").install({
			"bash", "c", "go", "html", "javascript", "lua", "luadoc", "markdown", "rust", "typescript", "tsx",
		})
	end,
}
