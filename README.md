# Catálogo de Chaveiros — PET Educação

Catálogo institucional publicado pelo GitHub Pages. Apresenta fotos, cores e disponibilidade dos chaveiros. Sem preços, carrinho ou pagamentos.

## Páginas

- `index.html`: capa e botões Ver chaveiros e Saiba mais.
- `catalogo.html`: modelos, cores, disponibilidade, pesquisa e filtros.
- `contato.html`: Instagram do PET Educação.
- `painel.html`: gerenciamento dos produtos e textos com acesso autorizado via GitHub.

## Segurança do painel

**Não existe senha de administrador salva no HTML ou JavaScript.** O site público não consegue proteger uma senha própria de modo seguro sem backend. Em seu lugar, o painel usa a API do GitHub com **token de acesso refinado** (*fine-grained personal access token*), gerado **pelo proprietário do repositório** e restrito ao próprio repositório, com acesso `Contents: Read and write`. O GitHub valida a autorização. O token é utilizado somente na memória da página enquanto ela está aberta, sem persistência em `localStorage` ou `sessionStorage`; atualizar ou fechar a aba solicita novo acesso.

1. Acesse https://github.com/settings/personal-access-tokens/new.
2. Crie um token **fine-grained**, com validade limitada e acesso **apenas** a `peteducacao/catalogo-chaveiros-pet`.
3. Em **Repository permissions**, selecione **Contents → Read and write**. O GitHub fornece Metadata/Read automaticamente.
4. Cole o token **apenas no formulário do painel** — nunca no chat, em arquivos do repositório ou em mensagens.
5. Revogue o token em https://github.com/settings/personal-access-tokens se desejar encerrar o acesso.

**Nota:** O navegador precisa ter acesso à API REST do GitHub. A fonte HTML e JavaScript continuará visível em “Inspecionar” porque GitHub Pages é estático. Os dados públicos do catálogo continuam públicos; **nenhum segredo ou senha de administrador** fica codificado nos arquivos. Um token pessoal pode ser visto pelo próprio usuário no tráfego da sua sessão e deve ser protegido. A antiga senha demonstrativa foi retirada do código atual, mas commits históricos podem mantê-la no histórico: **não a reutilize em outros serviços**.

## Como editar

Entre no painel com seu token. O botão **+ Novo chaveiro** abre um formulário com nome, descrição, imagem e cores. Você pode enviar uma foto diretamente do computador: a página a converte para WebP e a envia para `assets/produtos/` utilizando a API autenticada do GitHub. Também pode colar uma URL direta HTTPS de imagem, como `https://i.imgur.com/arquivo.jpg` (links de álbuns ou páginas não funcionam como imagem).

Cada cartão do painel tem **Disponível / Sem estoque**, **Editar** e **Excluir**. A disponibilidade é salva no `data/chaveiros.json` por commit. Na aba **Textos do catálogo**, o aviso geral é editado no `data/config.json`.

O GitHub Pages publica os novos commits automaticamente, podendo demorar alguns minutos. Alterações são **compartilhadas** após a publicação, não apenas neste navegador.

## Estrutura de dados

- `data/chaveiros.json`: array com `nome`, `descricao`, `imagem`, `cores`, `estoque`, `disponivel`, `imagemIlustrativa`, `legendaImagem`.
- `data/config.json`: `avisoImagens` para a mensagem geral acima da galeria.
- `assets/produtos/`: imagens enviadas pelo painel.

## Desenvolvedor

Sem frameworks nem serviços pagos; HTML, CSS e JavaScript. Configuração explícita de CSP, sem JavaScript de bibliotecas externas. **GitHub Pages continua hospedando somente o catálogo estático; as alterações são realizadas por chamadas à API do GitHub com autorização explícita do titular.**
