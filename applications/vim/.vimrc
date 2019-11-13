" vim
"
" Ryan Fowler


" Set directory for swapfiles
set directory=$HOME/.vim/tmp//

" Indent
filetype plugin indent on
set backspace=indent,eol,start

" Avoid line wrapping
set nowrap

" Syntax highlighting
syntax on

" Allow mouse
set mouse=a

" Display line numbers
set number

" Show cursor state
set ruler
set rulerformat=%l,%c

" Colours
"set background=dark
"highlight Normal ctermfg=white ctermbg=DarkGrey

" Highlight current line
"hi Cursor ctermfg=23 ctermbg=25 cterm=NONE guifg=#1C1C1C guibg=#EEEEEE gui=NONE
"hi CursorLine ctermfg=NONE ctermbg=DarkGrey cterm=NONE guifg=NONE guibg=#121212 gui=NONE
"hi CursorLineNr ctermfg=5 ctermbg=233 cterm=NONE guifg=#5F5F5F guibg=#121212 gui=NONE

set t_Co=256
set t_ut=
colorscheme codedark

