# Neuropil

> Neuropil is a synaptically dense region in the nervous system composed of mostly unmyelinated axons, dendrites and glial cell processes.

Neuropil is the cortex registry client.

## Usage

```js
var neuropil = require('neuropil')({
	username: 'foo',
	password: 'blah',
	host: 'http://registry.npm.lc',
	port: 80
});
```

## Method

### neuropil.adduser(options, callback)

##### options

- username `String`

- password `String`

- email `String`

##### callback `function(err, res, json)`

**PAY ATTENSION!**

`err` is the error message or `Error` instance caused by network problems and try-catched programming exceptions.

If we encountered `!err === true`, it was not always ok, logic errors, such as authentication refuse, validation errors will be responsed as `json.error`.

### neuropil.exists(options, callback)

##### options
- name `String`
- version `String`

##### callback `function(err, res, json)`

### neuropil.attachment(options, callback)

##### options
- tar `path` the pathname of the tarball file
- name `String` package name
- filename `String` the name of the attachment after uploaded to the server
- rev `String` couchdb rev

### neuropil.publish(options, callback)

##### options
- tar `path`
- pkg `Object` the parsed object of package.json
- force `Boolean=` if true, `neuropil` will override existing version. default to `false`

### neuropil.unpublish(options, callback)

##### options
- name `String`
- version `String` semantic version of the module, or '`*`' as all versions
- maintain_doc `Boolean=` if true, neuropil will maintain package document even if there's no versions in it after removing specific versions. default to `false`


### neuropil.install(options, callback)

##### options
- dependency_key `String` the key of dependencies in package.json, such as 'cortex.dependencies'
- dir `path` the directory which the tarballs to be downloaded and extracted into
- modules `Array.<String>` `['a@0.0.1', b@0.0.2]`

##### callback `function(err, data)`

The detail structure of `data`, see 'lib/command/install.js'


