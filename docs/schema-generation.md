# Generating a JSON schema using schema-guru

[schema-guru](https://github.com/snowplow/schema-guru) is a tool from Snowplow Analytics to automatically generate JSON schemas from a collection of JSON documents.  By using multiple input documents, it can generate schemas that can accomodate subtle differences in your data that might not be apparent from a single example.  For instance, if you have a field that is usually a string, but may occasionally be `null`, a single document will probably not be enough to determine that the field is nullable.

## Requirements & Setup

schema-guru runs on the Java virtual machine, so you'll need a recent JVM installed to run it. Then you can download the latest release and unzip it:


```
$ wget http://dl.bintray.com/snowplow/snowplow-generic/schema_guru_0.6.2.zip
$ unzip schema_guru_0.6.2.zip
```

This will give you an executable `schema_guru_0.6.2` file, which you may want to put somewhere that's on your `$PATH`.  In the examples below, I'll assume that you put it somewhere on your `$PATH` and renamed to just `schema-guru` (without the version).

## Preparing your data

You can give schema-guru either a single JSON document, or a directory containing a collection of documents.  The more example documents you provide, the better your results will be.  You can also pass in newline-delimited JSON (one JSON object per line), by giving the `--ndjson` flag when you run the command.

If your documents are already in newline-delimite JSON format, or you have a directory full of examples prepared, you're all set.

Some datasets might need pre-processing to get them into a usable format.

Let's use the [MoMA Collection data](https://github.com/MuseumofModernArt/collection) as an example.  The `Artworks.json` file consists of one big JSON array, each member of which is an object.  We want to turn that into newline-delimited JSON to feed to schema guru.

Using [jq](https://stedolan.github.io/jq/), we can easily unpack the array: `jq -c '.[]' Artworks.json > Artworks.ndjson` - the `.[]` jq filter selects each member of the array and prints it, and the `-c` flag instructs it to use "compact" printing, which results in one object per line.

## Generating the schema

Mediachain uses snowplow's [self-describing schema convention](https://github.com/snowplow/iglu/wiki/Self-describing-JSON-Schemas), which schema-guru can help you generate.

When you run the command, you can pass in `--vendor`, `--name`, and `--schemaver` flags to set the  schema's "self" properties.

* `--vendor` should be a reverse-dns style string, e.g. `io.mediachain` or `org.moma`.  
* `--name` should identify the type of record you're creating a schema for, e.g. `artwork`
  * `--schemaver` is a version string in [SchemaVer](https://github.com/snowplow/iglu/wiki/SchemaVer) format.  If this is the first revision of your schema, you should use `1-0-0` for `--schemaver`

To create the schema, you pass in your example data to schema-guru:

```
schema-guru schema --ndjson --no-length --vendor org.moma --name artwork --schemaver 1-0-0 --output org.moma-artwork-jsonschema-1-0-0.json Artworks.ndjson
```

The `--ndjson` flag is only necessary if you're using newline-delimited json; if you pass in a single document or a directory of documents, you should omit it.

The `--no-length` flag tells schema-guru not to try to infer the minimum and maximum length of string fields.  You probably don't want to set hard limits on your field lengths based on your examples, or you may end up with a schema that rejects valid data.

The `--output` flag specifies the output filename; without it, the schema will be printed to standard out.  If you want to pipe the schema to another command, just omit the `--output` flag.  The filename is up to you, but it's a good idea to include the vendor, name, and schemaver in the filename so you can easily keep track of your schemas and versions.

## Adding your schema to mediachain

Once you've generated a schema, you can publish it to mediachain with the `mcclient publishSchema` command:

```
mcclient publishSchema org.moma-artwork-jsonschema-1-0-0.json
```

This will result in output similar to the following:

```
Published schema with wki = schema:io.mediachain/moma-artwork/jsonschema/1-0-0 to namespace mediachain.schemas
Object ID: QmdfuvXHnKtewFeunFBBDHrTsG5qyHBFCruWWh4xxXm9PA
Statement ID: 4XTTM6XcpMB8N8Tnkhc66DqvAotgKzRJgrZbF7SBByihtPnV8:1478191051:34005
```

The `Object ID` above is used as the `--schemaReference` flag when publishing records.  To ingest the MoMA artworks:

```
mcclient publish --namespace museums.moma.artworks --idFilter '.ObjectID | tostring | "moma:artwork:" + .' --schemaReference QmdfuvXHnKtewFeunFBBDHrTsG5qyHBFCruWWh4xxXm9PA Artworks.ndjson
```

The `mcclient publish` command also accepts newline-delimited json, so we give it the same file we prepared earlier as the final argument.  If the argument is ommitted, it will read from standard input.

The `--idFilter` flag is a jq filter that massages the `ObjectID` field from the input object, converts it from a number to a string, then prepends the string "moma:artwork:" to it.  This produces a mediachain "WKI" (well-known-identifier), that can be used to look up the records in queries.  The actual `ObjectID` field in the record is not altered; the filter is just used to extract an id for mediachain usage.

The `--namespace` flag is also required to give the records a "home" in the mediachain hierarchy.

The `--schemaReference` is the object ID of the schema we published earlier