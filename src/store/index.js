import Vue from 'vue'
import Vuex from 'vuex'
import { LocalStorage, SessionStorage } from 'quasar'
import { posts, aggregates, encryption } from 'aleph-js'
import {
  get_nuls_balance_info, get_ethereum_balance_info, get_neo_balance_info } from '../services/balances'
import { encrypt_content, decrypt_content } from '../services/encryption.js'
  

// import example from './module-example'

Vue.use(Vuex)

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation
 */

export default function (/* { ssrContext } */) {
  const Store = new Vuex.Store({
    state: {
      api_server: 'https://api2.aleph.im',
      site_chain: 'NULS',
      site_address: 'TTatYAULiEfV6e7Tqt9z8YCr7dz2KkbJ',
      network_id: 1,
      ipfs_gateway: 'https://ipfs.io/ipfs/',
      account: null,
      profiles: {},
      last_broadcast: null,
      categories: [ // categories are hard-coded for now...
      ],
      pages: {},
      menu: [],
      notes: [],
      notebooks: {},
      files: [],
      mb_per_aleph: 0.25,
      balance_info: {},
      channel: "MYALEPH"
    },
    mutations: {
      set_account(state, account) {
        if (state.account !== account) {
          state.notes = []
          state.files = []
        }
        state.account = account
      },
      set_pages(state, pages) { // TODO: handle per-page mutation
        state.pages = pages
      },
      set_files(state, files) { // TODO: handle per-files mutation
        state.files = files
      },
      set_notes(state, notes) {
        state.notes = notes
      },
      set_notebooks(state, notebooks) {
        state.notebooks = notebooks
      },
      update_note(state, new_note) {
        for (let note of state.notes) {
          if (note.hash === new_note.hash) {
            Object.assign(note, new_note)
          }
        }
      },
      update_file(state, new_file) {
        for (let file of state.files) {
          if (file.hash === new_file.hash) {
            Object.assign(file, new_file)
          }
        }
      },
      update_notebook(state, payload) {
        // Object.assign(state.notebooks[payload.key], payload.notebook)
        Vue.set(state.notebooks, payload.key, payload.notebook)
      },
      add_note(state, new_note) {
        state.notes.unshift(new_note)
      },
      add_file(state, new_file) {
        state.files.unshift(new_file)
      },
      add_notebook(state, payload) {
        Vue.set(state.notebooks, payload.key, payload.notebook)
        // state.notebooks[payload.key] = payload.notebook
      },
      set_menu(state, menu_items) {
        state.menu = menu_items
      },
      store_profile(state, payload) {
        state.profiles[payload.address] = payload.profile
      },
      set_network(state, payload) {
        state.network_id = payload.network_id
        state.api_server = payload.api_server
        state.profiles = {}
        state.pages = {}
        state.address_alias = {}
        state.alias_address = {}
        state.last_broadcast = null
      },
      set_balance_info(state, balance_info) {
        state.balance_info = balance_info
      }
    },
    actions: {
      async store_account({ state, commit }, account) {
        try {
          LocalStorage.set('account', account)
        } catch (e) {
          console.warn("Can't store account")
        }
        await commit('set_account', account)
      },
      async logout({ state, commit }) {
        try {
          LocalStorage.set('account', null)
        } catch (e) {
          console.warn("Can't store account")
        }
        await commit('set_account', null)
      },
      async update_notes({ state, commit }, progress_callback) {
        let result = await posts.get_posts('note', {
          pagination: 1000,
          addresses: [state.account.address],
          api_server: state.api_server
        })
        let post_list = []
        let i = 0
        for (let post of result.posts) {
          i += 1
          try {
            if (post.content.private) {
              await decrypt_content(post.content, ['title', 'body', 'notebook'], state.account)
              // post.content.encrypted_title = post.content.title
              // post.content.title = encryption.decrypt(state.account, post.content.title)
              // post.content.encrypted_body = post.content.body
              // post.content.body = encryption.decrypt(state.account, post.content.body)
            }
          } catch (e) {
            console.error("Can't decrypt...", e)
          }
          if (progress_callback !== undefined)
            await progress_callback(i / result.posts.length)
          post_list.push(post)
        }
        commit('set_notes', post_list)
      },
      async update_files({ state, commit }, progress_callback) {
        let result = await posts.get_posts('file,folder', {
          pagination: 10000,
          addresses: [state.account.address],
          api_server: state.api_server
        })
        let post_list = []
        let i = 0
        for (let post of result.posts) {
          i += 1
          try {
            if ((post.content.private)|(post.type==='folder')) {
              await decrypt_content(post.content, ['filename', 'mimetype', 'thumbnail_url'], state.account)
            }
          } catch (e) {
            console.error("Can't decrypt...", e)
          }
          if (progress_callback !== undefined)
            await progress_callback(i / result.posts.length)
          post_list.push(post)
        }
        commit('set_files', post_list)
      },
      async update_balance({ state, commit }) {
        if (state.account !== null) {
          if (state.account.type === 'NULS2') {
            commit('set_balance_info', await get_nuls_balance_info(
              state.account.address, 'https://nuls.world'
            ))
          } else if (state.account.type === 'ETH') {
            commit('set_balance_info', await get_ethereum_balance_info(
              state.account.address, 'https://api.ethplorer.io'
            ))
          } else if (state.account.type === 'NEO') {
            commit('set_balance_info', await get_neo_balance_info(
              state.account.address, 'https://api.neoscan.io'
            ))
          }
        }
      },
      async update_notebooks({ state, commit }, progress_callback) {
        let notebooks = await aggregates.fetch_one(
          state.account.address,
          'notebooks', {
          api_server: state.api_server
        })
        if (notebooks !== null) {
          let i = 0
          let key_len = Object.keys(notebooks).length
          for (let [key, item] of Object.entries(notebooks)) {
            i += 1
            try {
              if (item.private) {
                await decrypt_content(item, ['name', 'description'], state.account)
              }
            } catch (e) {
              console.error("Can't decrypt...", e)
            }
            if (progress_callback !== undefined)
              await progress_callback(i / key_len)
          }
        } else
          notebooks = {}
        commit('set_notebooks', notebooks)
      }
      // async update_pages({ state, commit }) {
      //   let pages = await fetch_one(
      //     state.site_address, 'pages', {
      //     'api_server': state.api_server
      //   })
      //   if (pages === null)
      //     pages = {}
  
      //   await commit('set_pages', pages)
      // },
      // async update_menu({ state, commit }) {
      //   let menu_obj = await fetch_one(
      //     state.site_address, 'menu', {
      //     'api_server': state.api_server
      //   })
      //   let items = []
      //   if ((menu_obj !== null) && menu_obj.items)
      //     items = menu_obj.items
  
      //   await commit('set_menu', items)
      // }
    },

    modules: {
      // example
    },

    // enable strict mode (adds overhead!)
    // for dev mode only
    strict: process.env.DEV
  })

  return Store
}
