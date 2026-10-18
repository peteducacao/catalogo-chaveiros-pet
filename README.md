# Catálogo de Chaveiros — PET Educação

Site institucional demonstrativo do PET Educação — Conexão de Saberes.

## Páginas
- `index.html`: capa e cartões de navegação
- `catalogo.html`: modelos, cores disponíveis, estoque e filtros
- `contato.html`: Instagram do PET
- `painel.html`: editor demonstrativo de produtos

As imagens dos modelos de teste são **ilustrativas**, e essa informação aparece nas fotos e descrições dos cards. Substitua por fotos reais antes de usar os produtos como catálogo oficial.

## Painel: limitação importante

O painel está em um site público **estático do GitHub Pages**. O acesso usa verificação no navegador e **não constitui segurança real**. Não coloque informações sigilosas no painel nem reutilize uma senha pessoal. As alterações feitas nele usam `localStorage`: ficam **apenas neste navegador e dispositivo**. Elas **não atualizam o GitHub automaticamente**.

Para atualizar o site para todos:
1. Use o painel e clique em **Exportar JSON**.
2. Abra o arquivo `data/chaveiros.json` do repositório.
3. Substitua seu conteúdo pelo JSON exportado e faça commit.
4. Acrescente suas fotos reais à pasta `assets/`, caso use caminhos locais.
5. Aguarde o GitHub Pages atualizar o site.

Para um painel seguro com alterações globais instantâneas, implemente depois um serviço de autenticação real e um banco de dados.

### Estrutura de um produto

```json
{
  "id": "pedagogia",
  "nome": "Chaveiro Pedagogia",
  "descricao": "Modelo de teste. Imagem ilustrativa.",
  "imagem": "assets/mock-pedagogia.svg",
  "cores": [{"nome": "Azul", "hex": "#2f6ec9"}],
  "estoque": 7,
  "disponivel": true,
  "imagemIlustrativa": true,
  "demonstrativo": true
}
```

Não há preços nem pagamentos. O botão **Saiba mais** leva para `https://www.instagram.com/pet.educacao/`.
