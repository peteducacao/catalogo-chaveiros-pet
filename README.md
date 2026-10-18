# Catálogo de Chaveiros — PET Educação

Site informativo do PET Educação — Conexão de Saberes, com páginas independentes, catálogo de modelos e link **Saiba mais** para [@pet.educacao](https://www.instagram.com/pet.educacao/).

> **Versão demonstrativa:** os quatro produtos, imagens ilustrativas, cores e disponibilidade são exemplos de teste. Não há preços, carrinho ou pagamentos no site.

## Páginas
- `index.html` — capa com três cartões de navegação
- `catalogo.html` — modelos, cores disponíveis, disponibilidade, busca e filtros
- `como-funciona.html` — como navegar e consultar informações
- `contato.html` — Instagram do PET

## Como alterar os chaveiros

Use o arquivo [`data/chaveiros.json`](data/chaveiros.json). Cada item contém:
- `id`: identificador único (sem espaços)
- `nome`: nome do chaveiro
- `descricao`: descrição curta
- `imagem`: caminho da foto, por exemplo `assets/meu-chaveiro.jpg`
- `cores`: lista de cores, com `nome` e código hexadecimal `hex`
- `disponivel`: `true` ou `false`; `false` mostra **Sem estoque**
- `demonstrativo`: `true` mostra **MODELO DE TESTE**, `false` mostra **MODELO PET**

Para adicionar um modelo, duplique um objeto dentro do array JSON, altere seus dados e faça commit. Para excluir, remova seu objeto. Você também pode acrescentar fotos em `assets/` pelo editor do GitHub. **Nunca coloque senhas, tokens ou dados privados no repositório público.**

## Editar sem instalar nada

No GitHub: abra o arquivo `data/chaveiros.json`, clique no lápis (Edit), altere os dados e use **Commit changes**. Os visitantes verão a atualização após a publicação da nova versão no GitHub Pages.

## Visualizar localmente

O catálogo carrega JSON por `fetch`, então use um servidor local (abrir o HTML diretamente com `file://` pode bloquear o carregamento). Exemplo com Python:

```bash
python -m http.server 8000
```

Depois acesse http://localhost:8000

## Publicar, se decidir fazer isso

No repositório: **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**. Publique somente após conferir os dados, as imagens e as regras de uso do GitHub Pages. A criação de arquivos neste repositório **não ativa automaticamente o GitHub Pages**.

## Administração futura

Esta primeira versão evita um login falso/inseguro dentro de um site estático: o acesso de edição é feito pelo próprio GitHub, autenticado. Um painel privado com cadastro e fotos em tempo real exigirá autenticação e armazenamento separados; pode ser acrescentado mais tarde.

## Estrutura
```text
├── index.html
├── catalogo.html
├── como-funciona.html
├── contato.html
├── data/chaveiros.json
└── assets/
    ├── styles.css
    ├── app.js
    ├── logo-pet.svg
    ├── favicon.svg
    └── mock-*.svg
```
